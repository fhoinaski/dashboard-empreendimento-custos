import type { Metadata } from "next"
import LoginForm from "@/components/login-form"

export const metadata: Metadata = {
  title: "Login | Scotta Empreendimentos Dashboard",
  description: "Login to access your Scotta Empreendimentos dashboard",
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
      <LoginForm />
    </div>
  )
}

