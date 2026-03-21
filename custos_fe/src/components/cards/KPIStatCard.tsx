import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPIStatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  className?: string;
}

export function KPIStatCard({ title, value, subValue, icon: Icon, className }: KPIStatCardProps) {
  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-caption font-medium text-muted-foreground">{title}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 text-xl font-semibold tracking-tight">
          {value}
          {subValue != null && <span className="text-muted-foreground">{subValue}</span>}
        </p>
      </CardContent>
    </Card>
  );
}
