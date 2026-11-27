// webpack's loaders handle these imports; TS 6 type-checks side-effect imports.
declare module "*.css";
declare module "*.scss";

// webpack emits "?url" imports as files and gives back their URL.
declare module "*?url" {
  const url: string;
  export default url;
}
