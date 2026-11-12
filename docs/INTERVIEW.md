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

## Fase 6 — Les proves

### Començar una prova és una sola operació (033)
**La frase:** "Canviar de prova toca dues taules, així que ho fa una funció del servidor en una sola transacció."

Quan l'amfitriona comença una prova, l'anterior passa a feta, la nova a activa i `party_state` apunta a la nova. Si ho fera el client amb tres crides, una connexió que cau a mitges podria deixar dues proves actives o la pantalla dels convidats apuntant a la prova equivocada. A més, un índex únic parcial (`where status = 'active'`) garanteix a la base de dades que només n'hi pot haver una d'activa, encara que algú escriga directament a la taula.

**Pregunta de seguiment:** *Per què un índex i no només la funció?* → Perquè la funció només protegeix el camí "bo". L'amfitriona també pot editar la taula (per RLS), i la regla ha d'aguantar per qualsevol camí.

### Puntuar un equip d'un sol toc (008, 033)
**La frase:** "La festa és caòtica, així que puntuar ha de ser tocar caretes i un botó."

L'amfitriona selecciona qui ha guanyat (una persona o tot l'equip) i toca 🥇 100, 🥈 50, 🥉 25 o 🙌 10, o escriu un número. És una sola crida a `award_challenge_points`. Si s'equivoca, torna a tocar i el valor se sobreescriu (la clau única del ledger fa que no se sumen), o tria "Treure punts". La barra de punts és *sticky* perquè, amb 30 jugadors al mòbil, no calga fer scroll per arribar-hi.

### No es pot esborrar una prova amb punts (033)
**La frase:** "Una prova amb punts no s'esborra fins que no traus els punts a propòsit."

`points_ledger.source_id` no és una clau forana, perquè pot apuntar a una pregunta, una prova o una actuació. Si s'esborrara una prova puntuada, els punts quedarien orfes al rànquing. La política de `delete` usa `challenge_has_points()`, el mateix patró que vaig fer per als jugadors amb activitat (024). Un esborrat refusat per RLS torna "0 files", no un error, i la UI ho explica.

### Un component de rànquing per als dos premis
**La frase:** "Els dos rànquings són la mateixa consulta sobre vistes diferents, així que comparteixen component."

Vaig moure el rànquing del quiz a `features/leaderboard/` i el vaig fer genèric. El de la festa llegeix la vista `party_leaderboard` (proves + show, amfitriona inclosa) i el del quiz `quiz_leaderboard`. Els dos escolten `points_ledger`, amb el mateix patró de "timbre i tornar a llegir".

### Com ho he provat
**La frase:** "Les regles noves de la base de dades tenen un test cadascuna, i el flux l'he jugat amb l'ordinador i el mòbil alhora."

15 tests pgTAP nous (91 en total): només l'amfitriona comença o acaba proves, només en la fase de proves, només una activa, l'esborrat bloquejat amb punts i permès sense, i les longituds. Després vaig jugar el flux sencer en local, amb l'amfitriona a l'ordinador i un convidat al mòbil per la wifi: començar una prova, puntuar, corregir, treure punts i acabar-la.

**Pregunta de seguiment:** *Per què l'amfitriona a l'ordinador i no al mòbil?* → En local, l'enllaç del magic link apunta a `127.0.0.1`, que al mòbil és el mateix mòbil. Els convidats entren de manera anònima, sense correu, i funcionen bé al mòbil. El login de l'amfitriona des del mòbil es prova a producció, on l'enllaç va a l'adreça de Vercel.

## Fase 7 — El show final

### Actua → Vota → Resultat (034)
**La frase:** "Cada actuació passa per tres estats, i cada canvi és una funció del servidor."

L'amfitriona toca ▶️ Començar (`start_act`), 🗳️ Obrir votació (`open_voting`) i ✅ Tancar (`close_voting`, que ja existia i dona els punts). Separar "actuant" de "votant" fa que ningú vote abans que l'actuació acabe, i dona a tots els mòbils una pantalla clara de "Ara a l'escenari". Un índex únic parcial garanteix que només hi ha una actuació a l'escenari, encara que s'escriga directament a la taula (el mateix patró que les proves, 033).

**Pregunta de seguiment:** *Què passa si l'amfitriona toca "Següent" mentre encara s'està votant?* → La base de dades ho refusa ("Primer tanca la votació"). Si no, eixos vots es quedarien sense puntuar per un toc equivocat.

### No pots votar la teua actuació (009, 034)
**La frase:** "La regla de no votar-se a si mateix està a la base de dades, no al botó."

`cast_vote` comprova que qui vota no és membre de l'actuació, i la UI només ho explica ("No pots votar la teua actuació 🙈"). Si la regla estiguera només al frontend, qualsevol podria cridar l'RPC des de la consola. Tornar a votar canvia el vot (upsert), així que no es pot votar dues vegades.

### Realtime amb RLS per als vots (034)
**La frase:** "He afegit els vots a Realtime sense filtrar res: Realtime aplica l'RLS de cada subscriptor."

L'amfitriona veu el comptador de vots en directe (5 / 28). Els convidats escolten la mateixa taula, però l'RLS fa que cadascú només reba el seu vot. El resultat que veuen els convidats ve del ledger de punts (punts ÷ punts per estrela), així que mai no llegeixen el vot de ningú altre.

### Apuntar-se durant tota la festa (034)
**La frase:** "La inscripció és un botó flotant que viu a la pàgina, no a cada pantalla."

`GuestPage` embolica les pantalles del lobby, el quiz i les proves amb un botó "🎤 Apunta't al show". No hi ha ruta nova: és un estat local que mostra la pantalla d'inscripció. S'amaga mentre una pregunta del quiz està oberta, perquè ningú perda punts per distraure's. Cadascú pot retirar la seua actuació mentre encara no ha passat per l'escenari (`withdraw_act`).

### Com ho he provat
**La frase:** "Cada regla nova té un test, i el flux sencer l'he provat contra l'API real amb tres usuaris."

16 tests pgTAP nous (107 en total): només l'amfitriona i només en la fase show, una sola actuació a l'escenari, no es pot canviar mentre es vota, no es pot votar mentre s'actua, retirar només la teua i només si està pendent, i l'esborrat bloquejat amb punts. A més, un script amb `supabase-js` va jugar una actuació sencera amb tres sessions anònimes (amfitriona + dos convidats) contra el Supabase local, per comprovar l'RLS dels vots i la consulta dels membres tal com la fa el frontend.

## Fase 8 — Rànquing únic i pantalla final

### Un sol rànquing, i les regles a la vista (035)
**La frase:** "Vaig canviar dos rànquings per un de sol sense tocar cap funció de puntuació: només vaig canviar la vista."

Els punts ja estaven en un sol ledger. Per tant, passar de dos premis a un va ser esborrar `party_leaderboard` i crear `leaderboard`, que suma el quiz i les proves i agafa el màxim del show. Les funcions que donen punts no han canviat. Això és el que la decisió 003 prometia: "un rànquing nou és només una vista nova".

**Pregunta de seguiment:** *Per què "només la millor actuació" a la vista i no a l'hora de donar els punts?* → Perquè el ledger ha de dir la veritat: eixe acte va traure 1200 punts. Quins compten és una regla del joc, i si la canviem és una línia a la vista, no reescriure punts ja donats.

### Equilibrar abans de sumar (035)
**La frase:** "Abans de sumar tres jocs diferents vaig comprovar les escales, i una d'elles en valia 25 vegades més."

El quiz podia donar uns 25.000 punts, i les proves i el show junts uns 1.000. Un total sense canviar res hauria sigut el rànquing del quiz. Ho vaig arreglar amb dades, no amb codi: una migració canvia `scoring_config` (proves 3000/2000/1000/500, show 300 per estrela). El show pesa menys perquè és voluntari, i qui no actua no ha de quedar molt enrere.

**Pregunta de seguiment:** *Per què no normalitzar cada bloc a percentatges?* → És més just en teoria, però més difícil d'explicar a la festa ("tens 3000 punts" s'entén; "tens un 34%" no). Amb tres números de configuració n'hi havia prou.

### Menys informació al mòbil
**La frase:** "Provant-ho al mòbil vaig veure que 30 noms després de cada pregunta saturaven, així que cada convidat només veu qui té davant i darrere."

La targeta `PositionCard` mostra tres files: qui et trau punts, tu i qui en treus. La llista sencera només ix al podi del quiz i al final. El quiz ensenya només els punts del quiz, i la resta de pantalles el "Rànquing general", que és el del premi.

### La host decideix quan ix el podi
**La frase:** "El podi del quiz és una columna a `party_state`, no un estat de React, perquè l'han de veure tots els mòbils alhora."

El primer intent calculava "és l'última pregunta?" al client, però l'RLS amaga als convidats les preguntes que encara no s'han obert, i per això sempre semblava l'última. La solució va ser més simple: la host toca "Mostrar podi a tothom", i això escriu `quiz_podium` amb el mateix permís per columna que `phase`. Qui recarrega la pàgina també veu el podi.

**Pregunta de seguiment:** *Per què no una funció del servidor que diga si és l'última?* → La vaig fer, i funcionava. Però la host volia triar ella el moment del podi, i amb això la funció sobrava. Vaig preferir esborrar-la abans de pujar-la a producció.

### La fase és la revelació
**La frase:** "La pantalla final no té cap estat nou: canviar la fase a `finished` ja és el moment de la revelació."

`FinalResults` és un sol component per al mòbil dels convidats i per al panell de l'amfitriona: guanyador (o empat), podi i rànquing sencer, amb la meua posició destacada. Com que tot ve de la base de dades, qui torna a obrir la pestanya després veu el mateix.

### Com ho he provat
**La frase:** "La regla nova té tests que la trenquen a propòsit: dos actes del mateix convidat, un empat i l'amfitriona amb punts."

8 tests pgTAP nous (115 en total): suma de les tres fonts, només compta el millor acte, empats amb el mateix rank, convidat sense punts amb 0, l'amfitriona fora, i que només ella pot mostrar el podi del quiz. També vaig actualitzar els tests que tenien els 100 punts per estrela escrits a mà.

