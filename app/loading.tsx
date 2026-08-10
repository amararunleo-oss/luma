export default function Loading() {
  return <main className="site-container loading-shell" aria-label="Loading"><div className="loading-heading"><i /><b /><span /></div><div className="loading-grid">{Array.from({ length: 8 }, (_, index) => <article key={index}><div /><i /><b /><span /></article>)}</div></main>;
}
