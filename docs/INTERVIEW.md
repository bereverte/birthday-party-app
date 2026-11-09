# Preparació d'entrevistes

Explicacions de les decisions del projecte, per fases, preparades per contar-les en una entrevista. Cada punt té **la frase** (el resum en una línia), l'explicació i, de vegades, una **pregunta de seguiment** que et podrien fer.

El detall tècnic complet de cada decisió és a [DECISIONS.md](../DECISIONS.md) (els números entre parèntesis hi remeten).

---

## Presentació del projecte (30 segons)

> "És una app en temps real per a una festa d'aniversari d'unes 30 persones. Els convidats entren escanejant un QR amb el mòbil, sense registrar-se, i juguen un quiz estil Kahoot sobre l'amfitriona, unes proves i un show final amb votacions. La vaig fer amb React, TypeScript i Supabase. El més interessant és com he fet que funcione bé amb mòbils amb dades, on les connexions cauen contínuament: la base de dades és l'única font de veritat, Realtime només avisa, i tota la puntuació es calcula al servidor perquè ningú puga fer trampa."

---

## Fase 1 — Base del projecte i entorn local

### Supabase en local amb Docker (012)
**La frase:** "Tota la base de dades és reproduïble des de git."

Desenvolupe contra un Supabase complet al portàtil (Postgres, Auth, Realtime, Studio, Mailpit) que arranca la CLI amb Docker. L'schema és a `supabase/migrations/` i les dades d'exemple a `seed.sql`. `supabase db reset` reconstrueix la BD des de zero en segons. A producció s'apliquen les mateixes migracions amb `supabase db push`.

**Per què:** és gratis, ràpid i funciona sense connexió. A més, els magic links arriben a Mailpit en local, i així no gaste el límit d'emails del servidor de producció.

**Pregunta de seguiment:** *Per què el seed no té les files "singleton"?* → Perquè `db push` no executa mai `seed.sql`. Si `party_state` o `scoring_config` estigueren només al seed, l'app no arrancaria a producció. Per això van dins d'una migració (016).

### Un únic client de Supabase, tipat
**La frase:** "Els tipus es generen des de la BD, així que si canvia l'schema, TypeScript m'avisa."

Hi ha un sol client a `src/lib/supabase.ts`, tipat amb `database.types.ts`, que genera `supabase gen types`. Si canvie una columna i no actualitze el codi, el build falla.

### Estructura de carpetes per funcionalitat (013)
**La frase:** "Tot el que és del quiz està junt."

Organitze el codi en `src/features/<feature>/` (join, quiz, challenges, show, leaderboard), més `hooks/`, `lib/` i `components/ui/` compartits. Les pàgines són primes: només decideixen què es mostra segons la fase de la festa.

**Per què:** amb un termini ajustat, trobar i canviar les coses ràpid val més que una arquitectura per capes.

### Rate limit dels sign-ins anònims (011)
**La frase:** "Amb dades mòbils, 30 persones poden compartir la mateixa IP."

Supabase permet, per defecte, 30 sign-ins anònims per hora i per IP. Els operadors mòbils fan servir CGNAT, és a dir, molts mòbils ixen a Internet amb la mateixa IP pública. Si tots entren alhora, podríem tocar el límit. L'he pujat a 300. Reconnectar no compta, perquè la sessió es guarda al navegador.

---

## Fase 2 — Model de dades, seguretat i lògica al servidor

### La BD és l'única font de veritat; Realtime és un timbre (001)
**La frase:** "Realtime no em porta les dades, només m'avisa que alguna cosa ha canviat."

Tot l'estat del joc viu a Postgres. Quan arriba un avís de Realtime, el client torna a llegir de la BD. Cap client depén d'haver rebut tots els missatges: si se'n perd un, la següent lectura ho arregla. (La implementació al frontend és a la fase 3.)

### `party_state`: una fila fa de màquina d'estats (002)
**La frase:** "Qualsevol mòbil llig una fila i ja sap què ha de pintar."

Una taula amb una sola fila (`id = 1`) guarda la fase actual (lobby, quiz, proves, show, final), la pregunta actual i el seu estat, i les hores del servidor en què s'obri i es tanca. Qui es reconnecta llig eixa fila i ja està al dia. Com que només hi ha una festa, no hi ha taula `parties`.

### Un sol registre de punts i dos rànquings com a vistes (003)
**La frase:** "Com un extracte bancari: guarde cada moviment, mai el total."

Cada punt donat és una fila de `points_ledger` (jugador, punts, d'on ve). No hi ha cap total guardat. Els dos rànquings (Quiz i Festa) són vistes que sumen el ledger filtrant per origen. Un rànquing nou és només una vista nova, sense migrar dades.

**Idempotència:** una restricció `unique(player_id, source_type, source_id)` fa que tancar una pregunta dues vegades no duplique els punts, i que tornar a puntuar una prova sobreescriga en lloc de sumar (així es poden corregir errors).

**Pregunta de seguiment:** *I el rendiment de sumar cada vegada?* → Amb 30 persones i uns centenars de files és insignificant. A gran escala hi posaria una vista materialitzada o una taula de totals actualitzada per trigger.

### L'amfitriona és administradora i jugadora alhora (004)
**La frase:** "Separe qui pot controlar el joc de qui juga."

Té una fila a `hosts` (permisos) i una altra a `players` (participació). Juga a les proves i al show però no al quiz, perquè el quiz va sobre ella. `submit_answer` la rebutja i el rànquing del quiz l'exclou.

### La resposta correcta, en una taula a part (005)
**La frase:** "RLS filtra files, no columnes, així que l'amague en una altra taula."

Si `is_correct` fora una columna de `quiz_options`, qualsevol convidat la veuria amb DevTools. La resposta correcta viu a `quiz_keys`, que només pot llegir l'amfitriona, o tothom un cop s'ha revelat la pregunta.

### RLS per a les lectures i RPC per a les escriptures sensibles (014)
**La frase:** "El navegador parla amb Postgres amb una clau pública, així que la seguretat ha d'estar a la BD."

Qualsevol pot enviar consultes des de DevTools. RLS és un filtre que Postgres afegeix a cada consulta, fila per fila. Les **lectures** les controlen les policies. Les **escriptures** que impliquen punts o l'hora del servidor no tenen cap policy d'escriptura: només les fan funcions SQL. Al rol `anon` (sense sessió) li he tret tots els permisos. Els convidats anònims fan servir el rol `authenticated`, perquè tenen un usuari de veritat.

**Restricció per columnes:** l'amfitriona pot canviar `phase` directament (amb un `GRANT UPDATE` només d'eixa columna), però l'estat de la pregunta només el canvien `open/close/reveal_question`, que fan servir l'hora del servidor.

### Les preguntes s'amaguen fins que s'obrin (017)
**La frase:** "Si no, algú es llegiria totes les preguntes per endavant i guanyaria el bonus de velocitat."

Els convidats només veuen la pregunta actual, i només quan ja s'ha obert. Les policies la comparen amb `party_state.current_question_id`, així que la visibilitat segueix el joc sola.

### Puntuació al servidor amb hores del servidor (006)
**La frase:** "No em fie mai del rellotge del client."

L'hora de cada resposta la posa Postgres (`default now()`). Punts per una resposta correcta = punts base + bonus × (1 − temps tardat / temps límit). El client només fa servir `server_now()` per pintar el compte enrere.

**Qui tanca la pregunta:** el dispositiu de l'amfitriona crida `close_question()` quan s'acaba el temps. No cal cron: si es retarda, no passa res, perquè `submit_answer` ja rebutja les respostes fora de temps.

### Constants de puntuació en una taula (007)
**La frase:** "Puc canviar els punts des de Studio sense redesplegar."

Com que la puntuació es calcula en SQL, les constants han de viure a la BD. Hi ha una fila de `scoring_config` que també llig el frontend per pintar coses com "+500".

### Funcions `security definer` protegides (015)
**La frase:** "Una funció definer s'executa amb els permisos de la propietària, així que ha de comprovar ella mateixa qui la crida."

Cada una:
1. comprova `auth.uid()` i `is_host()`, perquè se salta RLS;
2. fixa `search_path = ''` i fa servir noms complets (`public.players`), perquè ningú puga fer-li executar una taula o funció falsa amb privilegis de propietària;
3. té el permís `EXECUTE` llevat a `public` i `anon`, perquè Postgres el dona a tothom per defecte.

Regla: només faig servir definer quan qui crida ha de fer una cosa que no podria fer directament, i de manera controlada.

### La cursa entre respondre i tancar (015)
**La frase:** "Cap resposta pot entrar després de calcular els punts."

`submit_answer` llig `party_state` amb `FOR SHARE` i `close_question` amb `FOR UPDATE`. Les respostes poden anar en paral·lel entre elles, però el tancament espera que acaben les que estan en marxa, i una resposta que arriba després del tancament ja veu `closed`. `cast_vote` i `close_voting` fan el mateix amb `show_acts`.

**Pregunta de seguiment:** *Per què no un nivell d'aïllament més estricte?* → Amb un bloqueig de fila puntual n'hi ha prou i és més previsible; `SERIALIZABLE` obligaria a reintentar transaccions des del client.

### Regles del show a la BD: no es pot votar la teua actuació (009)
**La frase:** "Una regla a la BD no la pot saltar un client modificat."

`cast_vote` rebutja els membres de l'actuació. La clau primària `(act_id, voter_id)` permet un sol vot per persona i actuació (si tornes a votar, el canvies).

### Proves per equips: una crida, molts jugadors (008)
**La frase:** "L'amfitriona estarà ocupada; una acció per equip és més ràpida i dona menys errors."

### Tests de BD amb pgTAP (018)
**La frase:** "Les regles viuen a la BD, així que les testege allí, sense navegador."

Cada test s'executa dins d'una transacció que es desfà al final. Per actuar com un usuari, canvie al rol `authenticated` i pose `request.jwt.claims`, que és exactament el que fa Supabase en cada petició. Així RLS, `auth.uid()` i les RPC es comporten com a producció. Com que `now()` es queda fix dins d'una transacció, els tests posen les hores explícitament en lloc d'esperar.

---

## Fase 3 — Frontend base i entrada a la festa

### El patró "timbre → refetch" (019)
**La frase:** "Cap client depén d'haver rebut tots els esdeveniments."

Realtime no em porta les dades: només m'avisa que alguna cosa ha canviat, i jo torne a llegir la BD, que és l'única font de veritat. Torne a llegir en cinc moments:
- quan arriba un avís,
- quan el canal queda connectat (també després de cada reconnexió),
- quan la pestanya torna a ser visible,
- quan el navegador torna a tindre connexió,
- quan l'amfitriona prem "force resync".

Si un mòbil perd avisos perquè tenia la pantalla bloquejada, la següent lectura ho arregla.

**Agrupació de lectures:** només faig una lectura alhora. Si arriben avisos mentre llig, marque les dades com a "brutes" i en faig una més en acabar. 30 joins seguits → 2 lectures, no 30, i una resposta vella mai trepitja una de nova.

**Pregunta de seguiment:** *Per què no fas servir les dades que porta l'esdeveniment?* → Perquè els esdeveniments es poden perdre o arribar desordenats. Si no hi depenc, eixos errors no poden existir. El cost és una lectura més, i amb 30 persones és insignificant.

**Detall que demostra que ho he investigat:** cada ús del hook té un nom de canal únic, perquè `supabase.channel(nom)` retorna el canal existent amb eixe nom i `removeChannel` és asíncron. Amb StrictMode, React munta i desmunta dues vegades, i em tornaria un canal que s'està tancant.

### Presence per a "qui està en línia" (020)
**La frase:** "Estar connectat és un estat del moment, no una dada."

Si ho guardara a la BD (`last_seen`), caldria escriure-hi cada pocs segons, i un mòbil sense bateria continuaria apareixent com a connectat. Amb Presence, cada client s'apunta al canal i, quan li cau la connexió, el servidor de Realtime el trau i avisa tothom. "Qui ha vingut" sí que es guarda (taula `players`, via Postgres Changes); "qui hi és ara" va per Presence.

L'id de l'usuari va dins del payload, no com a clau, així que dues pestanyes de la mateixa persona compten com una i el canal no depén de qui ha iniciat sessió. Presence es perd quan cau la connexió, per això torne a apuntar-me cada vegada que el canal queda connectat.

### La sessió anònima en reconnectar (021)
**La frase:** "Reobrir la pestanya és el mateix usuari, sense tornar a registrar-se."

`signInAnonymously()` crea un usuari de veritat a `auth.users`, i supabase-js guarda els tokens al `localStorage` i els renova sol. Quan el convidat torna, és el mateix `auth.uid()`, i com que `players.id = auth.uid()` va directament al lobby, sense gastar un altre accés del límit. Només la perd si esborra les dades del navegador; aleshores entra com a persona nova i l'amfitriona pot eliminar el duplicat.

"Qui soc jo" el trac de la llista de jugadors en directe, així que si l'amfitriona m'elimina, torne al formulari automàticament.

### "Force resync" per Broadcast en un canal públic (022)
**La frase:** "El missatge no porta dades, només provoca una lectura que ja passa per RLS."

És un botó de rescat per si un mòbil sembla penjat. Qualsevol podria enviar `resync`, però només faria que els clients llegiren el que ja poden llegir. Un canal privat amb policies afegiria complexitat sense guanyar seguretat. Broadcast no s'envia a qui l'emet, així que l'amfitriona rellig les seues dades directament.

### Eliminar jugadors només si no tenen activitat (024)
**La frase:** "Una cascada a la BD pot esborrar més del que sembla."

Totes les claus foranes cap a `players` són `on delete cascade`. Eliminar un jugador actiu s'emportaria els seus punts, les seues respostes i els seus vots (canviaria la mitjana de les actuacions), i fins i tot les actuacions que ha creat, amb els altres membres dins. La policy només deixa eliminar jugadors sense activitat, que són els duplicats. La comprovació és una funció definer perquè ha de veure totes les files, sense els filtres de RLS de qui la crida.

**Pregunta de seguiment:** *Per què no canvies les FK a `restrict`?* → També seria vàlid. He preferit la policy perquè la regla és "només l'amfitriona, i només duplicats", i així la UI rep "0 files" i pot mostrar un missatge clar.

### Rellotge del servidor
**La frase:** "Mesure el desfasament amb el viatge d'anada i tornada més curt."

Faig 3 crides a `server_now()`, em quede la més ràpida i calcule `desfasament = hora del servidor − punt mig del viatge`. Com més curt és el viatge, més precís és el punt mig. Només el faig servir per pintar el compte enrere; puntuar, mai.

### Disseny i rendiment amb dades mòbils (023)
**La frase:** "Un aspecte propi construït amb uns pocs tokens."

Estil "festa de paper / stickers": vores gruixudes, ombres dures desplaçades i confeti de fons, definit com a tokens al `@theme` de Tailwind v4, de manera que les pantalles noves l'hereten. La font l'allotge dins de l'app (no depén de Google Fonts) i només carregue l'eix de gruix: 41 KB en lloc de 131 KB. Les animacions respecten `prefers-reduced-motion`.

### Com ho he provat
**La frase:** "He provat la reconnexió de veritat, no només el cas feliç."

A més dels tests pgTAP, vaig automatitzar Chrome amb dos convidats i l'amfitriona: magic link real llegit de Mailpit, convidat posat offline mentre canviava la fase i comprovació que es posava al dia en tornar, Presence en tancar un mòbil, i force resync comprovant que el convidat tornava a fer la petició.

## Fase 4 — Deploy

### Desplegar abans de fer el joc (025)
**La frase:** "He desplegat abans del quiz perquè els problemes de producció no es veuen en local."

En local no hi ha HTTPS, ni mòbils amb 4G, ni emails reals, ni el servidor de Realtime de veritat. Desplegant d'hora, cada funcionalitat nova es prova en eixes condicions només fent `git push`: Vercel està connectat al repo i desplega `main` automàticament. Les dues variables d'entorn les he posat a mà, sense la integració de Supabase per a Vercel, perquè crea variables amb noms de Next.js (`NEXT_PUBLIC_*`) que Vite no llegeix.

**Pregunta de seguiment:** *La clau de Supabase és pública al frontend, no és un problema?* → No, la publishable key està feta per anar al navegador. La seguretat no depén d'amagar-la, sinó de RLS i de les RPC, que comproven qui crida.

### L'esquema ve de les migracions; la config d'Auth, a mà (026)
**La frase:** "El núvol té exactament l'esquema que he testejat en local."

`supabase db push --remote` aplica les migracions i n'apunta l'historial, així que a les fases següents només s'aplicaran les noves. El `seed.sql` no s'hi puja: són dades de prova. La configuració d'Auth (anònims, rate limit de 300, URLs) l'he feta al panell i no amb `config push`, perquè el `config.toml` té les URLs de localhost i trencaria el magic link de producció. La llista de redirect URLs és una protecció: Supabase només envia el magic link a adreces de la llista.

**Detall que demostra que ho he investigat:** sense `--remote`, `db push` apunta a la base de dades local. Sempre faig primer un `--dry-run` per veure quines migracions s'aplicaran.

### Permisos de la Data API (027)
**La frase:** "He llegit les meues migracions abans de fer cas a la recomanació del panell."

En crear el projecte, Supabase recomana no exposar automàticament les taules noves. Però la meua migració de RLS només trau els permisos a `anon` i compta amb els permisos per defecte per a `authenticated`. Si haguera desmarcat l'opció, totes les consultes haurien fallat amb "permission denied". La seguretat de veritat la fa RLS, activat explícitament a totes les taules.

### Rewrite per a una SPA (028)
**La frase:** "El magic link torna a `/host`, i eixa ruta només existeix al navegador."

React Router gestiona les rutes al client. Sense el rewrite de `vercel.json` cap a `index.html`, entrar directament a `/host` o recarregar qualsevol pàgina donaria un 404, perquè no hi ha cap fitxer `host.html`.

### Com ho he provat
**La frase:** "He provat en producció com serà el dia de la festa."

Amfitriona al portàtil amb el magic link real, convidat al mòbil amb dades mòbils (sense wifi), el convidat apareixent al panell en temps real, reconnexió tancant la pestanya, i force resync.

## Fase 4.5 — Redisseny visual

### Canviar tot l'estil sense tocar les pantalles (029)
**La frase:** "Com que l'estil vivia en tokens i components, el redisseny va ser canviar-los a ells."

L'estil d'adhesius em semblava massa infantil. Abans de tocar codi vaig fer una maqueta amb quatre direccions sobre les mateixes tres pantalles (entrar, sala d'espera i una pregunta) i en vaig triar una: fons pastel, targetes blanques amb ombra suau i sense contorns. Els canvis van ser sobretot als tokens del `@theme` i als components de `src/components/ui/`; a les pantalles només vaig traure classes puntuals (inclinacions, vores). Ho vaig fer abans del quiz perquè les pantalles noves ja nasquen amb l'estil definitiu.

**Pregunta de seguiment:** *Per què no vas deixar la prop `tilt` per si de cas?* → Perquè una opció que el disseny ja no fa servir és codi mort que algú acabaria fent servir per error. TypeScript em va dir exactament quines pantalles la usaven.

### Com ho he provat
**La frase:** "He mirat cada pantalla en un navegador de veritat, no només que compilara."

Vaig automatitzar Chrome a mida de mòbil: cinc convidats entrant, el formulari d'entrada, la sala d'espera i tot el flux de l'amfitriona (magic link de Mailpit, pantalla de "no ets amfitriona", panell) també a mida de portàtil. Les captures van destapar un tall al degradat de fons en pàgines llargues, que venia de `background-attachment: fixed`.

## Fase 5 — El quiz

### Qualsevol mòbil pot tancar la pregunta (030)
**La frase:** "Quan s'acaba el temps, els 30 mòbils demanen tancar la pregunta, i un bloqueig a la base de dades fa que només un faça la feina."

Abans només el mòbil de l'amfitriona tancava la pregunta. Si se li bloquejava la pantalla, tothom es quedava esperant. Ara, quan el compte enrere arriba a 0, tots els mòbils criden `close_question`. La funció fa `select … for update` sobre `party_state`, així que les crides es posen en cua: la primera tanca i puntua, i la resta veuen que ja està tancada i ixen de seguida. L'hora es comprova després del bloqueig, sobre la fila bloquejada.

**Pregunta de seguiment:** *I si un mòbil té el rellotge avançat i la crida arriba massa d'hora?* → No és un error: la funció retorna `false` i el mòbil ho torna a provar en silenci al cap d'un segon. El compte enrere ja corregeix el desfasament amb `serverNow()`, però la base de dades sempre té l'última paraula.

### Dades que depenen de la pregunta actual
**La frase:** "Mai ensenye dades d'una pregunta que no és la que hi ha en pantalla."

Els hooks del quiz depenen de la pregunta actual, i quan canvia la pregunta no sempre arriba un esdeveniment de Realtime per a cada taula. Per això vaig fer `useKeyedRefetch`, un embolcall de `useRealtimeRefetch` que torna a llegir quan canvia la clau (la pregunta) i descarta qualsevol resultat llegit per a la clau anterior. El reveal, a més, espera que arribe la resposta correcta, perquè "has fallat" no aparega ni un moment per culpa d'una lectura feta just abans del reveal.

**Pregunta de seguiment:** *Per què no llegir directament el contingut de l'esdeveniment?* → Perquè el patró de tota l'app és "timbre i tornar a llegir" (DECISIONS 001, 019): l'esdeveniment només diu que alguna cosa ha canviat i la base de dades és l'única font de veritat.

### Tres tipus de pregunta amb una sola fila de resposta (031)
**La frase:** "Vaig afegir multiselecció i número sense tocar el comptador, Realtime ni el bonus de velocitat."

Cada jugador continua tenint una sola fila per pregunta a `quiz_answers`, amb només una de les tres columnes plena: `option_id`, `option_ids` o `number_value`. Així continuen funcionant igual el "ja has respost", el comptador de l'amfitriona, la RLS i el temps de resposta. El número correcte va en una taula a part (`quiz_number_keys`) amb la mateixa RLS que les opcions correctes, perquè els convidats poden llegir la pregunta mentre està oberta però no la resposta. Cada tipus té una funció pròpia i xicoteta per respondre, i totes comparteixen les mateixes comprovacions.

### La fórmula de la multiselecció, en tres intents (031)
**La frase:** "La primera fórmula tenia un forat que vaig trobar fent números, i la segona no em va convéncer en jugar-la."

1. `(correctes − falses) ÷ total correctes`: amb 4 correctes i 2 falses, marcar-ho tot donava el 50 %, així que marcar-ho tot compensava.
2. `correctes ÷ total correctes − falses ÷ total falses`: marcar-ho tot ja donava sempre 0, però en jugar vaig veure que marcar una falsa d'entre 4 opcions encara donava la meitat dels punts.
3. **La final:** si marques una falsa, 0 punts; si no, et quedes la part de correctes que hages marcat. És la més fàcil d'explicar ("si no n'estàs segura, no la marques").

Amb els números va passar una cosa semblant: "a 1 de distància, la meitat" és massa generós si la resposta és 3, però no si és 57. Per això el marge (`number_tolerance`) es tria per a cada pregunta, i per defecte només val l'exacte.

**Pregunta de seguiment:** *Com et vas assegurar que la fórmula fa el que dius?* → Amb un test pgTAP per a cada cas de la taula: 100 %, 75 %, 0 % si marques una falsa i 0 % si ho marques tot, a més de l'exacte, el marge i el bonus de velocitat.

### Les respostes reals no van al repo
**La frase:** "El repo és públic, així que les preguntes de veritat es carreguen a mà i el fitxer està al `.gitignore`."

`supabase/quiz-content.example.sql` és una plantilla amb una llista JSON (tipus, opcions i lletres de les correctes) que es copia a `quiz-content.sql` i s'executa a l'SQL Editor. Tot va en una sola transacció i el script es nega a executar-se si algú ja ha respost, perquè no es puga esborrar un quiz a mitges la nit de la festa.

### Sessions òrfenes
**La frase:** "Una sessió guardada pot sobreviure al seu usuari, i l'app ho detecta."

Després d'un `db reset` local, els navegadors dels convidats guardaven un token que semblava vàlid, però l'usuari ja no existia i entrar a la festa fallava amb un error genèric. Ara, en carregar, l'app pregunta una vegada al servidor d'Auth i, si respon `user_not_found`, descarta la sessió i n'obri una de nova. Si l'error és de xarxa, manté la sessió.

### Com ho he provat
**La frase:** "La puntuació la proven els tests, i el flux l'he jugat amb diversos navegadors alhora."

62 tests pgTAP, entre ells el tancament per part d'un convidat, les crides alhora, cada cas de puntuació i la resposta amagada fins al reveal. També un script de Node que simula dos convidats contra la Supabase local (responen, intenten tancar massa d'hora i tanquen alhora) i, finalment, partides de prova amb l'amfitriona a Chrome i convidats a Firefox i Edge.
