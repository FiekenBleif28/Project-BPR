const authBtn = document.getElementById('authBtn');
const profileCard = document.getElementById('profileCard');
const profileRole = document.getElementById('profileRole');
const logoutRoleBtn = document.getElementById('logoutRoleBtn');

function getSelectedRole() {
  return localStorage.getItem('selectedRole');
}

function updateRoleButton() {
  const role = getSelectedRole();
  if (authBtn) {
    if (role) {
      authBtn.textContent = 'Profil';
    } else {
      authBtn.textContent = 'Masuk';
      if (profileCard) profileCard.style.display = 'none';
    }
  }
}

function openProfile() {
  const role = getSelectedRole();
  if (!role) {
    window.location.href = 'login.html';
    return;
  }
  if (profileRole) {
    profileRole.textContent = role === 'admin' ? 'Admin' : 'User';
  }
  if (profileCard) {
    if (profileCard.style.display === 'block') {
      profileCard.style.display = 'none';
    } else {
      profileCard.style.display = 'block';
    }
  }
}

if (authBtn) {
  authBtn.addEventListener('click', openProfile);
}

if (logoutRoleBtn) {
  logoutRoleBtn.addEventListener('click', () => {
    localStorage.removeItem('selectedRole');
    updateRoleButton();
  });
}

document.addEventListener('click', (event) => {
  if (profileCard && !profileCard.contains(event.target) && event.target !== authBtn) {
    profileCard.style.display = 'none';
  }
});
document.addEventListener('DOMContentLoaded', updateRoleButton);
