import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRestaurantsByOwner, initDB } from "@/lib/db";
import Link from "next/link";
import Logo from "@/components/Logo";

export default async function Home() {
  const session = await auth();

  // Logged-in users get routed to their dashboard
  if (session?.user?.email) {
    await initDB();
    const restaurants = await getRestaurantsByOwner(session.user.email);
    if (restaurants.length > 0) {
      redirect(`/r/${restaurants[0].slug}`);
    }
    redirect("/onboarding");
  }

  // Landing page for visitors
  return (
    <div className="min-h-screen bg-[#eef0f4]">
      {/* Nav */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-xl font-bold text-slate-900">Mesa</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-slate-600 hover:text-slate-900 transition text-sm font-medium">
              Log in
            </Link>
            <Link href="/login" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition text-sm font-semibold">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-medium text-emerald-700 mb-8">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          AI-powered · No hardware needed
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
          Never miss a<br />reservation again
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Mesa is an AI receptionist that answers your restaurant&apos;s phone, takes reservations, and manages your seating — 24/7, no staff needed.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login" className="px-8 py-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition text-lg font-semibold shadow-lg shadow-slate-900/10">
            Start for free →
          </Link>
          <a href="#how-it-works" className="px-8 py-4 bg-white text-slate-700 rounded-2xl hover:bg-slate-50 transition text-lg font-medium border border-slate-200">
            See how it works
          </a>
        </div>
        <p className="text-sm text-slate-400 mt-4">Free to set up · No credit card required</p>
      </section>

      {/* Social proof bar */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-8 flex items-center justify-around text-center">
          <div>
            <div className="text-3xl font-bold text-slate-900">24/7</div>
            <div className="text-sm text-slate-400 mt-1">Always available</div>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div>
            <div className="text-3xl font-bold text-slate-900">&lt; 1s</div>
            <div className="text-sm text-slate-400 mt-1">Answer time</div>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div>
            <div className="text-3xl font-bold text-slate-900">0</div>
            <div className="text-sm text-slate-400 mt-1">Missed calls</div>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div>
            <div className="text-3xl font-bold text-slate-900">5 min</div>
            <div className="text-sm text-slate-400 mt-1">Setup time</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">How it works</h2>
        <p className="text-lg text-slate-500 text-center mb-12 max-w-xl mx-auto">Three steps to an AI receptionist that never calls in sick.</p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-8">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl mb-5">1️⃣</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Sign up & name your restaurant</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Create an account with Google, give your restaurant a name, and your AI agent is instantly created with a custom personality.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/60 p-8">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl mb-5">2️⃣</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Set up your floor plan</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Drag and drop your tables in our visual editor. Configure sections, capacity, and hours. The AI uses this to check real availability.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/60 p-8">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl mb-5">3️⃣</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Forward your phone</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Set up call forwarding on your existing restaurant number. When you can&apos;t answer, the AI picks up, greets the caller by your restaurant&apos;s name, and books the table.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Everything your front desk does, automated</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: "📞", title: "Takes reservations by phone", desc: "Natural voice conversation — asks for name, party size, date, time. One question at a time, just like a real human." },
            { icon: "📅", title: "Checks real-time availability", desc: "Knows your actual table layout, capacity, and hours. Suggests alternatives if the requested time is full." },
            { icon: "🗺️", title: "Visual floor plan", desc: "Drag-and-drop editor for your seating layout. See which tables are booked at a glance on your dashboard." },
            { icon: "🔄", title: "Modifies & cancels bookings", desc: "Callers can look up, change, or cancel existing reservations — the AI handles it all." },
            { icon: "🏪", title: "Multi-restaurant support", desc: "Own multiple locations? Each gets its own dashboard, AI agent, phone number, and floor plan." },
            { icon: "⚡", title: "Instant setup", desc: "Sign up → name your restaurant → your AI agent is live. Configure your floor plan whenever you're ready." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200/60 p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{icon}</div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-slate-900 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to stop missing calls?</h2>
          <p className="text-slate-400 mb-8 text-lg">Set up your AI receptionist in under 5 minutes. No credit card, no contracts.</p>
          <Link href="/login" className="inline-block px-8 py-4 bg-white text-slate-900 rounded-2xl hover:bg-slate-100 transition text-lg font-semibold">
            Get started for free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-bold text-slate-900">Mesa</span>
            <span className="text-sm text-slate-400 ml-2">© 2026</span>
          </div>
          <div className="text-sm text-slate-400">AI-Powered Restaurant Reservations</div>
        </div>
      </footer>
    </div>
  );
}
