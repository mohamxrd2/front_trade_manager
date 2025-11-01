import { ChartAreaInteractive } from "@/components/chart-area-interactive"

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
     <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="text-sm text-gray-500">
        View your analytics data here.
      </p>
      <div className="flex flex-col gap-4">
        <ChartAreaInteractive />

      </div>
     </div>
    </div>
  )
}

