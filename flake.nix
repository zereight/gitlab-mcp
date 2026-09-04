{
  description = "GitLab MCP server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = {nixpkgs, ...}: let
    systems = [
      "x86_64-linux"
      "aarch64-linux"
      "aarch64-darwin"
    ];
    forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

    packageJson = builtins.fromJSON (builtins.readFile ./package.json);
  in {
    packages = forAllSystems (pkgs: rec {
      default = gitlab-mcp;

      gitlab-mcp = pkgs.buildNpmPackage {
        pname = "gitlab-mcp";
        version = packageJson.version;

        src = ./.;

        nodejs = pkgs.nodejs_22;

        # Bump with `lib.fakeHash` -> build -> copy the reported hash whenever
        # package-lock.json changes.
        npmDepsHash = "sha256-3BG3sDzNtn7HfL20b8ZrAkQSV9/dQtYXIGySaWZ0ZDE=";

        meta = {
          description = packageJson.description;
          homepage = "https://github.com/zereight/gitlab-mcp";
          license = pkgs.lib.licenses.mit;
          mainProgram = "zereight-mcp-gitlab";
          platforms = systems;
        };
      };
    });

    devShells = forAllSystems (pkgs: {
      default = pkgs.mkShell {
        name = "gitlab-mcp";

        packages = [
          pkgs.nodejs_22

          # Docs site: `make serve` builds a venv from requirements-docs.txt (CI uses 3.12).
          pkgs.python312

          pkgs.git
          pkgs.jq
          pkgs.gh
        ];

        shellHook = ''
          export PATH="$PWD/node_modules/.bin:$PATH"
        '';
      };
    });
  };
}
