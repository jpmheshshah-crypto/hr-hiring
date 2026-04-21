"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="nav-pill nav-button" disabled={isLoggingOut} onClick={() => void logout()}>
      {isLoggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
