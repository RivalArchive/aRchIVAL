{
  description = "The Rival Archive";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    devshell.url = "github:numtide/devshell";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      devshell,
    }:
    flake-utils.lib.eachSystem
      (with flake-utils.lib.system; [
        x86_64-linux
        aarch64-linux
        x86_64-darwin
        aarch64-darwin
      ])
      (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            overlays = [ devshell.overlays.default ];
          };
          deps = with pkgs; [
            # Project management
            bun
            # Linting, formatting
            pre-commit
            nixfmt-rfc-style
            python312Packages.identify
            typos
          ];
        in
        {
          packages.geppetto = pkgs.callPackage ./packages/geppetto { };
          packages.staticify = pkgs.callPackage ./packages/staticify { };
          devShells.default = pkgs.callPackage ./nix/shell.nix {
            inherit deps;
            # We want the devshell pkg that was added via the overlay, not the input.
            inherit (pkgs) devshell;
          };
        }
      );
}
