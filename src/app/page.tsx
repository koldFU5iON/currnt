import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto w-lg ">
      <section className="bg-accent p-5 border-b ">
        <h1 className="text-3xl">Welcome to Resume</h1>
        <p>Let&apos;s get you back on track</p>
      </section>
      <section>
        <div className="p-2">
          <Link href="dashboard">
            <Button type="button">
              Continue to Dashboard
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )

}
