// src/components/shared/UnauthorizedState.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatePanel } from "./StatePanel";

type UnauthorizedStateProps = {
  /**
   * "signed-out": no session (HTTP 401). Offers sign in.
   * "forbidden": signed in but the role does not allow it (HTTP 403). Offers a way back.
   */
  kind?: "signed-out" | "forbidden";
  href?: string;
  linkLabel?: string;
};

// This component is display only. It is never the authorization check.
// Do not use "forbidden" for events the user is not a member of: show NotFoundState for those.
export function UnauthorizedState({ kind = "forbidden", href, linkLabel }: UnauthorizedStateProps) {
  const signedOut = kind === "signed-out";
  return (
    <StatePanel
      icon="lock"
      headingLevel={1}
      title={signedOut ? "Sign in to continue" : "You don't have access to this"}
      description={
        signedOut
          ? "Your session has ended or you haven't signed in yet."
          : "Your role on this event doesn't allow this action. Ask the event owner if you need access."
      }
    >
      <Button asChild>
        <Link href={href ?? (signedOut ? "/login" : "/events")}>
          {linkLabel ?? (signedOut ? "Sign in" : "Back to my events")}
        </Link>
      </Button>
    </StatePanel>
  );
}