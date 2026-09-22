import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleDismiss = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              
            </div>
            <h2 className="text-lg font-bold text-stone-900">Đã xảy ra lỗi giao diện</h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              Hệ thống ghi nhận sự cố bất ngờ khi kết xuất trang. Dữ liệu của bạn vẫn an toàn trong trình duyệt.
            </p>
            {this.state.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-left text-xs font-mono text-red-800 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={this.handleDismiss}
                className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Thử tiếp tục
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow transition-colors"
              >
                Tải lại trang (F5)
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
