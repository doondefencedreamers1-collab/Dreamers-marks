# Dreamers Edu — Performance Tracker (Live App)

Director aur Students ke liye ek real web app.
**Stack:** React (Vite) + Supabase (database + login) + Render (hosting).

- **Director** → email + password se login → students add karta hai, marks upload karta hai.
- **Student** → sirf roll number daal kar apni performance dekhta hai (read-only).
- Director marks upload karte hi student ke screen par analytics **apne aap update** ho jaate hain (live).

Aapko 3 free accounts chahiye: **GitHub**, **Supabase**, **Render**. Sab free tier mein chal jayega.

---

## STEP 1 — Supabase (Database + Login)

1. https://supabase.com par jaakar **Sign up** karein, phir **New Project** banayein.
   - Project name: `dreamers-edu` | Database password: koi strong password (note kar lein) | Region: closest (Singapore/Mumbai).
2. Project khulne ke baad left menu mein **SQL Editor** → **New query**.
3. Is project ki `supabase_schema.sql` file ka **poora content** copy karke paste karein → **Run** dabayein. (Ye `students` aur `tests` tables + security rules bana dega.)
4. Left menu **Authentication** → **Users** → **Add user** → **Create new user**:
   - Email: `doondefencedreamers1@gmail.com`
   - Password: `Lovedadu123**`
   - **Auto Confirm User** ko ON karein → **Create**.
   - (Yahi aapka Director login hai. Password yahan Supabase mein **encrypted** store hota hai — code mein nahi.)
5. Left menu **Project Settings** (gear icon) → **API**. Yahan se 2 cheezein copy karein (next step mein chahiye):
   - **Project URL** (jaise `https://abcd1234.supabase.co`)
   - **anon public** key (lambi key)

---

## STEP 2 — GitHub (Code upload)

1. https://github.com par account banayein → **New repository** → name `dreamers-edu` → **Private** → **Create**.
2. Repo page par **"uploading an existing file"** link dabayein.
3. Is folder ki **saari files/folders** drag-drop karein:
   `index.html`, `package.json`, `vite.config.js`, `.gitignore`, `.env.example`, `supabase_schema.sql`, `README.md`, aur poora `src` folder.
   - ⚠️ `node_modules` aur `dist` folder **mat** upload karna (zaroorat nahi).
4. **Commit changes** dabayein.

---

## STEP 3 — Render (Website live karna)

1. https://render.com par **Sign up** (GitHub se login kar sakte hain).
2. Dashboard → **New +** → **Static Site**.
3. Apna `dreamers-edu` GitHub repo connect/select karein.
4. Settings:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
5. **Environment Variables** section (Advanced) mein 2 add karein:
   - `VITE_SUPABASE_URL` = (Step 1 wala Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (Step 1 wali anon public key)
6. **Create Static Site** dabayein. Kuch minute mein deploy ho jayega.
   - Aapka live URL milega: `https://dreamers-edu.onrender.com` (jaisa naam diya wo).
7. (Optional, recommended) Site → **Settings** → **Redirects/Rewrites** → Add Rule:
   - Source `/*` → Destination `/index.html` → Action **Rewrite**. (Page refresh par 404 na aaye iske liye.)

> Aage jab bhi GitHub mein code update karenge, Render khud-ba-khud dobara deploy kar dega.

---

## STEP 4 — Use karna

1. Live URL kholein.
2. **Director tab** → email `doondefencedreamers1@gmail.com` + password se login.
3. Class kholo → **Add Student** (har student ko **unique roll number** do — wahi unka login hoga).
4. **Marks daalne ke 2 tareeke:**
   - **Ek-ek student:** **Upload Marks** → class → student → marks.
   - **Poori class ek saath (Excel):** **Bulk Excel** → class chuno → Test Name + Date → **Download Template** (.xlsx) → us file mein har student ke marks bharo (Roll, Name, subject columns) → file **upload** karo → preview dekho → **Upload All**. (Roll se purane students match honge; naya roll + Name diya to naya student khud ban jayega.)
5. **Kisi ek student ko jaldi dhoondna:** Dashboard par sabse upar **roll number search box** hai — roll daal kar Search dabao, seedha us student ka performance khul jayega.
6. **Students** ko bas wahi URL bhej do. Wo **Student tab** mein apna roll number daal kar apni performance dekh lenge — aur jab aap naye marks daloge, unka data live update ho jayega.

---

## Aksar poochhe jaane waale

**Password badalna hai?**
Supabase → Authentication → Users → us user par click → password reset. (Code chhune ki zaroorat nahi.)

**Naya director/teacher add karna hai?**
Supabase → Authentication → Add user. Har authenticated user director bann jaata hai (sab kuch edit kar sakta hai).

**Security:**
- Marks **add/edit/delete** sirf logged-in director kar sakta hai (Supabase RLS rules se enforce).
- Data **read** sabke liye open hai (taaki student roll se apna data dekh sake). Yaani technically jiske paas link ho wo doosre students ka data bhi dekh sakta hai agar wo unka roll jaanta ho.
- Agar aage har student ka data 100% private chahiye (sirf usi ko dikhe), to har student ka apna Supabase login banana padega — wo ek bada upgrade hai, baad mein add kar sakte hain.

**Free tier:** Supabase free project kuch hafton tak bilkul inactive rahe to "pause" ho sakta hai — dashboard se ek click mein resume ho jaata hai. Render free static site hamesha live rehti hai.
