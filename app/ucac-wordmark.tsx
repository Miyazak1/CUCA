export function UcacWordmark() {
  return (
    <picture className="brand-wordmark">
      <source media="(max-width: 560px)" srcSet="/ucac-wordmark-compact.svg" width={306} height={64} />
      <img
        src="/ucac-wordmark.svg"
        width={360}
        height={64}
        alt="UCAC — Study in China — University & College Application Center"
      />
    </picture>
  );
}
