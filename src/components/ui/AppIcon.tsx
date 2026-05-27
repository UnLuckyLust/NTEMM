import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { AppIconProps } from "@/types/app"

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

export default function AppIcon({ icon, className, title }: AppIconProps) {
  return (
    <FontAwesomeIcon
      icon={icon}
      title={title}
      className={cn("inline-block shrink-0", className)}
      fixedWidth
    />
  )
}