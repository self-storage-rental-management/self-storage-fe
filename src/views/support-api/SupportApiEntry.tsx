import { useState, type ReactNode } from "react"
import { Button } from "../../components/ui"
import SupportApiWorkspace from "./SupportApiWorkspace"

/** The primary Support route must never fall back to demo records after an API error. */
export function SupportApiRoute({
  apiAuthenticated,
  role,
  children,
}: {
  apiAuthenticated: boolean
  role: "customer" | "staff"
  children: ReactNode
}) {
  return apiAuthenticated ? <SupportApiWorkspace role={role} /> : children
}

/** Additive composition point owned by Dương; never replaces the team Support/Return screens. */
export default function SupportApiEntry({
  role,
  children,
}: {
  role: "customer" | "staff"
  children: ReactNode
}) {
  const [tab, setTab] = useState<"existing" | "support">("existing")
  const [locked, setLocked] = useState(false)
  return (
    <div className="min-w-0 space-y-4">
      <div
        role="tablist"
        aria-label="Nghiệp vụ API của Dương"
        className="flex flex-wrap gap-2"
      >
        <Button
          role="tab"
          aria-selected={tab === "existing"}
          disabled={locked}
          variant={tab === "existing" ? "primary" : "outline"}
          onClick={() => setTab("existing")}
        >
          {role === "customer" ? "Thuê & Gia hạn" : "Ký gia hạn"}
        </Button>
        <Button
          role="tab"
          aria-selected={tab === "support"}
          disabled={locked}
          variant={tab === "support" ? "primary" : "outline"}
          onClick={() => setTab("support")}
        >
          Hỗ trợ (D5 API)
        </Button>
      </div>
      {tab === "existing" ? (
        children
      ) : (
        <SupportApiWorkspace role={role} onLocked={setLocked} />
      )}
    </div>
  )
}
