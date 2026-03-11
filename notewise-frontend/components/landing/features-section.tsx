import { Card, CardContent } from "@/components/ui/card"
import { FolderOpen, FileText, Layers, BrainCircuit } from "lucide-react"

const features = [
  {
    icon: FolderOpen,
    title: "Workspaces",
    description: "Organize your courses and study topics into focused workspaces.",
  },
  {
    icon: FileText,
    title: "Summary Cards",
    description: "Get concise, evolving summaries that grow with your sources.",
  },
  {
    icon: Layers,
    title: "Multi-modal Sources",
    description: "Upload PDFs, docs, audio, paste text, or add links from anywhere.",
  },
  {
    icon: BrainCircuit,
    title: "Quizzes & Narration",
    description: "Generate quizzes, audio narration, and short videos on demand.",
  },
]

export function FeaturesSection() {
  return (
    <section className="border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-28">
        <div className="mb-12 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Everything you need to study smarter
          </h2>
          <p className="mt-3 text-muted-foreground">
            Powerful tools designed around the way students actually learn.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <CardContent className="flex flex-col items-start p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-card-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
