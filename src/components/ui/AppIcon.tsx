import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { IconProp } from "@fortawesome/fontawesome-svg-core"

type Props = {
  icon: IconProp
  className?: string
  title?: string
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

export default function AppIcon({ icon, className, title }: Props) {
  return (
    <FontAwesomeIcon
      icon={icon}
      title={title}
      className={cn("inline-block shrink-0", className)}
      fixedWidth
    />
  )
}