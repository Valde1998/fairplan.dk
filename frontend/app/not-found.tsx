import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>Siden findes ikke</h1>
      <p>Brug navigationen til at finde det, du leder efter.</p>
      <Link className="button primary" href="/perioder">
        Tilbage til perioder
      </Link>
    </div>
  );
}
