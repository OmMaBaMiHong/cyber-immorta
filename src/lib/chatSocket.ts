import type { ChatCivilizationLevel, ChatMode, DistillIntensity } from "@/types"

interface PendingChatRequest {
  onChunk?: (text: string) => void
  onStatus?: (status: { phase: string; text: string }) => void
  timeoutId?: number
  timeoutMs?: number
  resolve: (value: { donePayload: any }) => void
  reject: (reason?: unknown) => void
}

interface ChatSocketEventPayload {
  event?: string
  data?: string
  error?: string
  payload?: any
  client_message_id?: string
}

function resolveWsUrl(sessionId: string, token: string) {
  const base = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8091"
  const url = new URL(base)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = `/ws/chat/sessions/${sessionId}`
  url.search = new URLSearchParams({ token }).toString()
  return url.toString()
}

export class ChatSocketClient {
  private readonly sessionId: string
  private readonly token: string
  private socket: WebSocket | null = null
  private connectPromise: Promise<WebSocket> | null = null
  private readonly pending = new Map<string, PendingChatRequest>()

  constructor(sessionId: string, token: string) {
    this.sessionId = sessionId
    this.token = token
  }

  async sendMessage(params: {
    content: string
    mode: ChatMode
    distillIntensity?: DistillIntensity
    civilizationLevel?: ChatCivilizationLevel
    onChunk?: (text: string) => void
    onStatus?: (status: { phase: string; text: string }) => void
    timeoutMs?: number
  }) {
    const socket = await this.connect()
    const clientMessageId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const payload = {
      type: "chat_message",
      client_message_id: clientMessageId,
      content: params.content,
      mode: params.mode,
      distill_intensity: params.distillIntensity,
      civilization_level: params.civilizationLevel,
    }
    return await new Promise<{ donePayload: any }>((resolve, reject) => {
      const pending: PendingChatRequest = {
        onChunk: params.onChunk,
        onStatus: params.onStatus,
        timeoutMs: params.timeoutMs ?? 90000,
        resolve,
        reject,
      }
      this.pending.set(clientMessageId, pending)
      this.refreshPendingTimeout(clientMessageId, pending)
      try {
        socket.send(JSON.stringify(payload))
      } catch (error) {
        this.clearPendingTimeout(pending)
        this.pending.delete(clientMessageId)
        reject(error)
      }
    })
  }

  close() {
    if (this.socket) {
      try {
        this.socket.close()
      } catch {
        // ignore close failures
      }
    }
    this.socket = null
    this.connectPromise = null
    this.rejectAllPending(new Error("聊天连接已关闭"))
  }

  private async connect(): Promise<WebSocket> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return this.socket
    if (this.connectPromise) return this.connectPromise
    this.connectPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(resolveWsUrl(this.sessionId, this.token))
      let settled = false

      socket.onopen = () => {
        this.socket = socket
        settled = true
        resolve(socket)
      }
      socket.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      socket.onerror = () => {
        if (!settled) {
          reject(new Error("聊天连接建立失败"))
        }
      }
      socket.onclose = () => {
        this.socket = null
        this.connectPromise = null
        this.rejectAllPending(new Error("聊天连接已断开"))
      }
    })
    try {
      return await this.connectPromise
    } catch (error) {
      this.connectPromise = null
      throw error
    }
  }

  private handleMessage(raw: string) {
    let payload: ChatSocketEventPayload | null = null
    try {
      payload = JSON.parse(raw) as ChatSocketEventPayload
    } catch {
      return
    }
    const eventName = String(payload.event || "")
    if (!eventName || eventName === "ready" || eventName === "pong") return
    const clientMessageId = String(payload.client_message_id || "")
    if (!clientMessageId) return
    const pending = this.pending.get(clientMessageId)
    if (!pending) return
    if (eventName === "chunk") {
      this.refreshPendingTimeout(clientMessageId, pending)
      pending.onChunk?.(String(payload.data || ""))
      return
    }
    if (eventName === "status") {
      this.refreshPendingTimeout(clientMessageId, pending)
      const rawPayload = payload.payload && typeof payload.payload === "object" ? payload.payload : {}
      const phase = String((rawPayload as any).phase || payload.data || "working")
      const text = String((rawPayload as any).text || payload.data || "")
      pending.onStatus?.({ phase, text })
      return
    }
    this.pending.delete(clientMessageId)
    this.clearPendingTimeout(pending)
    if (eventName === "done") {
      pending.resolve({ donePayload: payload.payload ?? null })
      return
    }
    if (eventName === "error") {
      pending.reject(new Error(String(payload.error || "聊天服务异常")))
      return
    }
    pending.reject(new Error(`未知聊天事件: ${eventName}`))
  }

  private rejectAllPending(error: Error) {
    for (const pending of this.pending.values()) {
      this.clearPendingTimeout(pending)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private refreshPendingTimeout(clientMessageId: string, pending: PendingChatRequest) {
    this.clearPendingTimeout(pending)
    const timeoutMs = pending.timeoutMs ?? 90000
    pending.timeoutId = window.setTimeout(() => {
      this.pending.delete(clientMessageId)
      pending.reject(new Error("Hermes 响应超时，请稍后重试"))
      this.close()
    }, timeoutMs)
  }

  private clearPendingTimeout(pending: PendingChatRequest) {
    if (pending.timeoutId) {
      window.clearTimeout(pending.timeoutId)
      pending.timeoutId = undefined
    }
  }
}
