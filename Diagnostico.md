{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 Diagnostico de Codex el 24-02\
\
**Informe del proyecto (en lenguaje simple)**  \
Revis\'e9 todo el c\'f3digo propio del repositorio (sin contar `node_modules`, que son librer\'edas instaladas).\
\
**1) Qu\'e9 hace cada carpeta y archivo principal**\
\
Carpetas en la ra\'edz:\
- [.github](/Users/pablor/Documents/GitHub/climadatabcn/.github): automatiza publicaci\'f3n en GitHub Pages.\
- [.lovable](/Users/pablor/Documents/GitHub/climadatabcn/.lovable): notas internas/plan antiguo de migraci\'f3n.\
- [Documentos](/Users/pablor/Documents/GitHub/climadatabcn/Documentos): documentos sueltos de apoyo (no c\'f3digo de la app).\
- [docs](/Users/pablor/Documents/GitHub/climadatabcn/docs): documentaci\'f3n t\'e9cnica del proyecto.\
- [public](/Users/pablor/Documents/GitHub/climadatabcn/public): archivos est\'e1ticos (favicon, robots, etc.).\
- [scripts](/Users/pablor/Documents/GitHub/climadatabcn/scripts): script de diagn\'f3stico de datos.\
- [src](/Users/pablor/Documents/GitHub/climadatabcn/src): c\'f3digo principal de la aplicaci\'f3n web.\
- [supabase](/Users/pablor/Documents/GitHub/climadatabcn/supabase): funciones backend antiguas (se ve que no son la v\'eda actual).\
- [dist](/Users/pablor/Documents/GitHub/climadatabcn/dist): salida compilada para publicar.\
\
Archivos principales en ra\'edz:\
- [README.md](/Users/pablor/Documents/GitHub/climadatabcn/README.md): descripci\'f3n general.\
- [package.json](/Users/pablor/Documents/GitHub/climadatabcn/package.json): dependencias y comandos.\
- [.env.example](/Users/pablor/Documents/GitHub/climadatabcn/.env.example): variables de entorno de ejemplo.\
- [index.html](/Users/pablor/Documents/GitHub/climadatabcn/index.html): p\'e1gina base.\
- [vite.config.ts](/Users/pablor/Documents/GitHub/climadatabcn/vite.config.ts): configuraci\'f3n de arranque/compilaci\'f3n.\
- [tailwind.config.ts](/Users/pablor/Documents/GitHub/climadatabcn/tailwind.config.ts): dise\'f1o visual.\
- [eslint.config.js](/Users/pablor/Documents/GitHub/climadatabcn/eslint.config.js): reglas de calidad.\
- [.github/workflows/deply.yml](/Users/pablor/Documents/GitHub/climadatabcn/.github/workflows/deply.yml): flujo de publicaci\'f3n autom\'e1tica.\
\
Dentro de `src`:\
- [src/pages](/Users/pablor/Documents/GitHub/climadatabcn/src/pages): pantallas; [Index.tsx](/Users/pablor/Documents/GitHub/climadatabcn/src/pages/Index.tsx) es la principal.\
- [src/components](/Users/pablor/Documents/GitHub/climadatabcn/src/components): piezas de interfaz (selector, gr\'e1fica, tabla, exportaci\'f3n).\
- [src/components/ui](/Users/pablor/Documents/GitHub/climadatabcn/src/components/ui): biblioteca de componentes gen\'e9ricos de interfaz.\
- [src/hooks](/Users/pablor/Documents/GitHub/climadatabcn/src/hooks): l\'f3gica de carga de datos y estado.\
- [src/services](/Users/pablor/Documents/GitHub/climadatabcn/src/services): conexi\'f3n con fuentes de datos (XEMA/Socrata).\
- [src/lib](/Users/pablor/Documents/GitHub/climadatabcn/src/lib): c\'e1lculos, formateo, exportaci\'f3n Excel, cobertura de datos.\
- [src/config](/Users/pablor/Documents/GitHub/climadatabcn/src/config): variables y etiquetas.\
- [src/types](/Users/pablor/Documents/GitHub/climadatabcn/src/types) y [src/domain](/Users/pablor/Documents/GitHub/climadatabcn/src/domain): tipos de datos.\
- [src/integrations/supabase](/Users/pablor/Documents/GitHub/climadatabcn/src/integrations/supabase): cliente/tipos de Supabase, ahora casi sin uso real.\
- [src/test](/Users/pablor/Documents/GitHub/climadatabcn/src/test): configuraci\'f3n y pruebas de ejemplo.\
\
**2) Tecnolog\'edas y versiones que se usan**\
\
Principales:\
- React `18.3.1`\
- TypeScript `5.8.3`\
- Vite `5.4.x` (instalado `5.4.21`)\
- Tailwind CSS `3.4.17`\
- TanStack React Query `5.83.0`\
- Recharts `2.15.4`\
- Leaflet `1.9.4`\
- ExcelJS `4.4.0`\
- Supabase JS `2.93.3` (presente, pero no es la v\'eda principal actual)\
- Vitest `3.2.4` + Testing Library\
- ESLint `9.32.0`\
- En CI se usa Node `20` para publicar\
- En `supabase/functions` se usa Deno `std@0.168.0`\
\
**3) Qu\'e9 partes se ven claramente terminadas**\
\
- Flujo principal de la app: elegir estaci\'f3n, rango de fechas, ver indicadores, gr\'e1ficas y tabla.\
- Carga de datos desde XEMA/Socrata en estaciones y observaciones.\
- Alertas de cobertura cuando faltan d\'edas o tramos de 30 minutos.\
- Exportaci\'f3n a Excel con dos hojas y resaltado de viento fuerte.\
- Hay pruebas para l\'f3gica clave y pasan: `55 tests` OK.\
- Compilaci\'f3n OK y lint OK (`npm run build`, `npm run lint`).\
\
**4) Qu\'e9 partes parecen incompletas o inconsistentes**\
\
- [index.html](/Users/pablor/Documents/GitHub/climadatabcn/index.html) sigue con t\'edtulo y metadatos de plantilla (\'93Lovable App\'94) y comentarios TODO.\
- [README.md](/Users/pablor/Documents/GitHub/climadatabcn/README.md) no refleja del todo el estado real (habla de rutas internas y CSV, pero en la UI actual se exporta Excel y se tira directo de Socrata).\
- [supabase/functions](/Users/pablor/Documents/GitHub/climadatabcn/supabase/functions) usa Open\uc0\u8209 Meteo y c\'f3digos antiguos; hoy la app va por otra ruta.\
- [src/App.css](/Users/pablor/Documents/GitHub/climadatabcn/src/App.css) es resto de plantilla y no aporta al flujo actual.\
- [src/components/NavLink.tsx](/Users/pablor/Documents/GitHub/climadatabcn/src/components/NavLink.tsx) parece sin uso.\
- Hay muchos componentes de [src/components/ui](/Users/pablor/Documents/GitHub/climadatabcn/src/components/ui) que no se usan (aprox. 33 de 51).\
- Se mezclan etiquetas de tiempo: internamente se usa `30min`, pero en pantalla pone \'93Por horas\'94.\
- El rango inicial incluye hoy, pero los atajos de fecha excluyen hoy (comportamiento desigual).\
- Hay aviso de tama\'f1o grande al compilar (paquetes JS pesados).\
\
**5) Patrones mezclados o c\'f3digo duplicado**\
\
- Hay dos \'93formas de modelar datos\'94 a la vez: [src/types/weather.ts](/Users/pablor/Documents/GitHub/climadatabcn/src/types/weather.ts) y [src/domain/types.ts](/Users/pablor/Documents/GitHub/climadatabcn/src/domain/types.ts).\
- Hay piezas de arquitectura vieja y nueva conviviendo (servicios gen\'e9ricos + llamada directa a XEMA).\
- Se repiten utilidades parecidas en varios archivos (por ejemplo funciones de fecha y validaci\'f3n simple de n\'famero).\
- Hay dos herramientas de diagn\'f3stico muy parecidas: [src/lib/dataDebug.ts](/Users/pablor/Documents/GitHub/climadatabcn/src/lib/dataDebug.ts) y [scripts/dataDiagnostics.js](/Users/pablor/Documents/GitHub/climadatabcn/scripts/dataDiagnostics.js).\
- Hay definiciones de estaciones en m\'e1s de un sitio, con c\'f3digos distintos (viejos y nuevos).\
- Hay mezcla de idioma en textos de interfaz (espa\'f1ol/catal\'e1n/ingl\'e9s en distintas partes).}