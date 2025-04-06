{
  lib,
  devshell,
  deps,
}:
# Devshell normally uses a TOML configuration, but it's nice
# to keep everything in nix. Here's a helpful source for the nix configuration:
# https://github.com/numtide/devshell/blob/main/modules/devshell.nix.
let
  maintainers = import ./maintainers.nix;
in
devshell.mkShell {
  devshell = {
    name = "archival";
    meta = {
      description = "Development shell for the Rival Archive";
      maintainers = with maintainers; [ rdrew ];
    };
    prj_root_fallback = {
      eval = "$(git rev-parse --show-toplevel)";
    };
  };

  env = [
    {
      name = "PODMAN_COMPOSE_WARNING_LOGS";
      value = "false";
    }
  ];

  commands = (
    lib.lists.forEach deps (d: {
      package = d;
      name = d.pname;
      help = "${d.pname} ${d.version}";
      category = "development dependencies";
    })
  );
}
