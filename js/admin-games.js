(() => {
  let isAdmin = false;
  try {
    isAdmin = (localStorage.getItem('ahrenslabs_email') || '').trim().toLowerCase() === 'calebahrens2011@gmail.com';
  } catch {
    isAdmin = false;
  }
  if (isAdmin) document.querySelectorAll('[data-admin-only]').forEach((el) => { el.hidden = false; });
})();
