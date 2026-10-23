declare module "*.sql" {
  const source: string;
  export default source;
}

declare module "*.db" {
  const asset: number | string;
  export default asset;
}
