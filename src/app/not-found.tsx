import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-3xl font-extrabold">Page not found</h1>
      <p className="text-muted">We can&apos;t seem to find the page you&apos;re looking for.</p>
      <Link href="/" className="rounded-full bg-white px-6 py-2.5 font-bold text-black">Home</Link>
    </div>
  );
}
