#!/usr/bin/env python3
from pathlib import Path

path = Path("src/openhuman/config/schema/load/impl_load.rs")
text = path.read_text()

# Apply TAVIS fail-closed policy at every Config load return boundary, after
# migrations/env/decryption. save() is intentionally untouched.
replacements = [
    (
        """            tracing::debug!(\n                path = %config.config_path.display(),\n                workspace = %config.workspace_dir.display(),\n                source = resolution_source.as_str(),\n                initialized = false,\n                persisted = false,\n                \"Config loaded (pre-login, in-memory only — no dirs or files written)\"\n            );\n            return Ok(config);""",
        """            tracing::debug!(\n                path = %config.config_path.display(),\n                workspace = %config.workspace_dir.display(),\n                source = resolution_source.as_str(),\n                initialized = false,\n                persisted = false,\n                \"Config loaded (pre-login, in-memory only — no dirs or files written)\"\n            );\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            return Ok(config);""",
        1,
    ),
    (
        """            }\n            Ok(config)\n        } else {""",
        """            }\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            Ok(config)\n        } else {""",
        1,
    ),
    (
        """            crate::openhuman::config::migrations::run_pending(&mut config).await;\n            Ok(config)\n        }\n    }\n\n    /// Load config from the default user paths""",
        """            crate::openhuman::config::migrations::run_pending(&mut config).await;\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            Ok(config)\n        }\n    }\n\n    /// Load config from the default user paths""",
        1,
    ),
    (
        """            config.apply_env_overrides();\n            return Ok(config);""",
        """            config.apply_env_overrides();\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            return Ok(config);""",
        1,
    ),
    (
        """        let _ = decrypt_config_secrets(&mut config, &openhuman_dir)?;\n        Ok(config)""",
        """        let _ = decrypt_config_secrets(&mut config, &openhuman_dir)?;\n        crate::openhuman::config::apply_tavis_defaults(&mut config);\n        Ok(config)""",
        1,
    ),
    (
        """            config.apply_env_overrides_from(&ProcessEnvWithoutWorkspace);\n            return Ok(config);""",
        """            config.apply_env_overrides_from(&ProcessEnvWithoutWorkspace);\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            return Ok(config);""",
        1,
    ),
    (
        """        crate::openhuman::config::migrations::run_pending(&mut config).await;\n        Ok(config)\n    }\n\n    pub async fn save""",
        """        crate::openhuman::config::migrations::run_pending(&mut config).await;\n        crate::openhuman::config::apply_tavis_defaults(&mut config);\n        Ok(config)\n    }\n\n    pub async fn save""",
        1,
    ),
]

for old, new, expected in replacements:
    found = text.count(old)
    if found != expected:
        raise SystemExit(
            f"patch target mismatch: expected {expected}, found {found}: {old[:90]!r}"
        )
    text = text.replace(old, new, expected)

path.write_text(text)
