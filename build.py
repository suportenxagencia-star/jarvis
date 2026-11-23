"""Gera index.html (versão web) a partir do app do Claude + adaptador web."""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "src" / "app.html").read_text()
web = (ROOT / "src" / "web.js").read_text()

def rep(s, a, b):
    assert s.count(a) == 1, f"esperava 1 ocorrência de: {a[:80]!r} (achei {s.count(a)})"
    return s.replace(a, b)

out = src
# biblioteca do Supabase servida pelo próprio site
out = rep(out, "\n<script>\n", '\n<script src="vendor/supabase.js"></script>\n<script>\n')
# adaptador web antes do boot()
out = rep(out, "\nboot();\n", "\n" + web + "\nboot();\n")
# menu da conta
out = rep(out, "Alterar usuário e senha</button>",
          'Alterar senha</button><button data-act="wa-logout"><svg class="i" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.5H5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 5 15.5h3M12.5 13.5L16 10l-3.5-3.5M16 10H8"/></svg>Sair deste aparelho</button>')
out = rep(out, "<small>Conta privada: só você vê e edita estes dados</small>",
          "<small>${WUSER?esc(WUSER.email):\"Conta privada\"}</small>")
# meta para celular / instalação
out = rep(out, "<head>", '<head>\n<meta name="theme-color" content="#060C17">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="icon-180.png">')
out = out.replace(".lock-links{display:flex;justify-content:center}", ".lock-links{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}\n.lock-links.wl .lock-go{width:100%}")
(ROOT / "index.html").write_text(out)
print("ok", len(out))
