// src/components/shared/NotFoundState.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatePanel } from "./StatePanel";

type NotFoundStateProps = {
  /** What was not found, for example "event". Used in the default message only. */
  resource?: string;
  href?: string;
  linkLabel?: string;
};

// Security: use this for BOTH "does not exist" and "belongs to another event".
// The two cases must look identical so the page never confirms that a record exists.
export function NotFoundState({
  resource,
  href = "/",
  linkLabel = "Back to home",
}: NotFoundStateProps) {
  return (
    <StatePanel
      icon="not-found"
      headingLevel={1}
      title={resource ? `We couldn't find this ${resource}` : "Page not found"}
      description="It may have been removed, or the link may be wrong."
    >
      <Button asChild>
        <Link href={href}>{linkLabel}</Link>
      </Button>
    </StatePanel>
  );
}