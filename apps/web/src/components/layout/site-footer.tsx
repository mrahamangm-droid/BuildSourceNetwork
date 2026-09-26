import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="font-bold">Building Materials Network</p>
          <p className="mt-2 max-w-sm text-muted">
            Find suppliers, compare offers, request quotes and manage construction-material
            procurement in one place.
          </p>
        </div>
        <div>
          <p className="font-semibold">Explore</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              <Link href="/marketplace">Marketplace</Link>
            </li>
            <li>
              <Link href="/suppliers">Suppliers</Link>
            </li>
            <li>
              <Link href="/manufacturers">Manufacturers</Link>
            </li>
            <li>
              <Link href="/stores">Stores</Link>
            </li>
            <li>
              <Link href="/blog">Blog</Link>
            </li>
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/tools">Free tools</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Join</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              <Link href="/register?type=SUPPLIER">As a supplier</Link>
            </li>
            <li>
              <Link href="/register?type=STORE">As a store</Link>
            </li>
            <li>
              <Link href="/register?type=CONTRACTOR">As a contractor</Link>
            </li>
            <li>
              <Link href="/login">Sign in</Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Building Materials Network
      </p>
    </footer>
  );
}
