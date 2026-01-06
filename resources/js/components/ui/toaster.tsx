import { useEffect, useState, useRef, useCallback } from "react"
import { Toast, ToastClose, ToastDescription, ToastTitle } from "@/components/ui/toast"
import { usePage, router } from "@inertiajs/react"

export interface ToastData {
  id: string
  title?: string
  description?: string
  variant?: "default" | "success" | "destructive" | "warning"
  duration?: number
}

// Global toast store for programmatic access
class ToastStore {
  private listeners: Set<(toasts: ToastData[]) => void> = new Set()
  private toasts: ToastData[] = []

  subscribe(listener: (toasts: ToastData[]) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.toasts]))
  }

  addToast(toast: Omit<ToastData, "id">) {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastData = {
      ...toast,
      id,
      duration: toast.duration ?? 4000, // Default 4 seconds as per guide
    }
    this.toasts.push(newToast)
    this.notify()

    // Auto remove after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        this.removeToast(id)
      }, newToast.duration)
    }
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter(toast => toast.id !== id)
    this.notify()
  }

  getToasts() {
    return [...this.toasts]
  }
}

export const toastStore = new ToastStore()

export function Toaster() {
  const page = usePage()
  const flash = (page.props as { flash?: { success?: string; error?: string; warning?: string } })?.flash
  const [toasts, setToasts] = useState<ToastData[]>([])
  const previousFlashRef = useRef<string>("")
  const processedMessagesRef = useRef<Set<string>>(new Set())

  // Subscribe to global toast store
  useEffect(() => {
    const unsubscribe = toastStore.subscribe(setToasts)
    // Initialize with current toasts
    setToasts(toastStore.getToasts())
    return unsubscribe
  }, [])

  const removeToast = useCallback((id: string) => {
    toastStore.removeToast(id)
  }, [])

  const addToast = useCallback((toast: Omit<ToastData, "id">) => {
    toastStore.addToast(toast)
  }, [])

  const processFlashMessages = useCallback((flashMessages: { success?: string; error?: string; warning?: string } | undefined) => {
    if (!flashMessages) return

    // Create a unique key from the actual message content
    const messages: string[] = []
    if (flashMessages.success) messages.push(`success:${flashMessages.success}`)
    if (flashMessages.error) messages.push(`error:${flashMessages.error}`)
    if (flashMessages.warning) messages.push(`warning:${flashMessages.warning}`)
    
    if (messages.length === 0) return

    const messageKey = messages.join('|')
    
    // Check if we've already processed this exact message
    if (processedMessagesRef.current.has(messageKey)) {
      return
    }

    // Mark as processed
    processedMessagesRef.current.add(messageKey)
    
    // Clean up old messages after 5 seconds to allow same message to show again if needed
    setTimeout(() => {
      processedMessagesRef.current.delete(messageKey)
    }, 5000)

    // Create a unique flash key for comparison
    const flashKey = JSON.stringify(flashMessages)
    
    // Only show toast if flash messages have changed
    if (flashKey !== previousFlashRef.current) {
      previousFlashRef.current = flashKey

      if (flashMessages.success) {
        addToast({
          title: "Success",
          description: flashMessages.success,
          variant: "success",
          duration: 4000,
        })
      }
      if (flashMessages.error) {
        addToast({
          title: "Error",
          description: flashMessages.error,
          variant: "destructive",
          duration: 4000,
        })
      }
      if (flashMessages.warning) {
        addToast({
          title: "Warning",
          description: flashMessages.warning,
          variant: "warning",
          duration: 4000,
        })
      }
    }
  }, [addToast])

  useEffect(() => {
    // Process flash messages from page props
    processFlashMessages(flash)
  }, [flash, processFlashMessages])

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-2 md:max-w-[320px]"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          className="pointer-events-auto"
        >
          <div className="grid gap-0.5">
            {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
            {toast.description && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
          </div>
          <ToastClose onClick={() => removeToast(toast.id)} />
        </Toast>
      ))}
    </div>
  )
}

// Export a hook to manually add toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = (toast: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastData = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    }
    setToasts((prev) => [...prev, newToast])

    // Auto remove after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return { toasts, addToast, removeToast }
}
