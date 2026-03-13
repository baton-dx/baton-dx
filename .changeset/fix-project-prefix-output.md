---
"@baton-dx/cli": patch
---

fix(core): strip `@project/` prefix from rendered output in link and reference include modes

`<!-- baton:include src="@project/README.md" mode="reference" -->` now correctly renders as `See @README.md for additional context.` instead of `See @@project/README.md for additional context.`. Same fix applied to link mode output.
