import { getUserProfile, isLoggedIn, followUser, unfollowUser, getLikedEmotions, updateBio } from "./api";
import { createCard } from "./card";
import { getUsername } from "./state";
import { t } from "./i18n";

// Generative avatar — deterministic pattern from username hash
function drawAvatar(canvas: HTMLCanvasElement, username: string) {
  const ctx = canvas.getContext("2d")!;
  const size = canvas.width;

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  }
  const rng = (n: number) => {
    hash = ((hash * 1664525 + 1013904223) | 0) + n;
    return (hash >>> 0) / 0xffffffff;
  };

  const hue = Math.floor(rng(0) * 360);
  ctx.fillStyle = `hsl(${hue}, 30%, 12%)`;
  ctx.fillRect(0, 0, size, size);

  const cell = size / 5;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (rng(row * 3 + col) > 0.45) {
        const h2 = (hue + Math.floor(rng(col) * 60) - 30 + 360) % 360;
        const l = 45 + Math.floor(rng(row) * 30);
        ctx.fillStyle = `hsl(${h2}, 80%, ${l}%)`;
        ctx.fillRect(col * cell, row * cell, cell, cell);
        ctx.fillRect((4 - col) * cell, row * cell, cell, cell);
      }
    }
  }
}

export function mountProfile(app: HTMLElement, username: string) {
  const wrap = document.createElement("div");
  wrap.className = "profile-wrap";

  const loading = document.createElement("div");
  loading.className = "feed-empty";
  loading.textContent = t("loading");
  wrap.appendChild(loading);
  app.appendChild(wrap);

  getUserProfile(username).then(profile => {
    wrap.innerHTML = "";

    // ── Header ─────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "profile-header";

    const avatarCanvas = document.createElement("canvas");
    avatarCanvas.width = 80;
    avatarCanvas.height = 80;
    avatarCanvas.className = "profile-avatar";
    drawAvatar(avatarCanvas, profile.username);

    const headerInfo = document.createElement("div");
    headerInfo.className = "profile-header-info";

    const nameEl = document.createElement("div");
    nameEl.className = "profile-name";
    nameEl.textContent = profile.username;

    const stats = document.createElement("div");
    stats.className = "profile-stats";
    const joinDate = new Date(profile.created_at).toLocaleDateString();
    stats.innerHTML = `
      <span>${profile.emotion_count} ${t("emotions")}</span>
      <span>${profile.likes_count} ${t("likes")}</span>
      <span>${profile.followers_count} ${t("followers")}</span>
      <span>${profile.following_count} ${t("following")}</span>
      <span>${t("joined")}: ${joinDate}</span>
    `;

    headerInfo.appendChild(nameEl);
    headerInfo.appendChild(stats);

    // Bio
    const isOwnProfile = getUsername() === profile.username;
    const bioWrap = document.createElement("div");
    bioWrap.className = "profile-bio-wrap";

    if (isOwnProfile) {
      const bioArea = document.createElement("textarea");
      bioArea.className = "profile-bio-input";
      bioArea.maxLength = 160;
      bioArea.placeholder = t("bioPlaceholder");
      bioArea.value = profile.bio || "";
      bioArea.rows = 2;

      const bioSave = document.createElement("button");
      bioSave.className = "action-btn profile-bio-save";
      bioSave.textContent = t("saveBio");
      bioSave.addEventListener("click", async () => {
        bioSave.disabled = true;
        try {
          await updateBio(profile.username, bioArea.value.trim());
        } finally {
          bioSave.disabled = false;
        }
      });

      bioWrap.appendChild(bioArea);
      bioWrap.appendChild(bioSave);
    } else if (profile.bio) {
      const bioText = document.createElement("div");
      bioText.className = "profile-bio-text";
      bioText.textContent = profile.bio;
      bioWrap.appendChild(bioText);
    }

    headerInfo.appendChild(bioWrap);

    // Follow button (only for other users)
    if (isLoggedIn() && !isOwnProfile) {
      let following = profile.is_following;
      const followBtn = document.createElement("button");
      followBtn.className = `action-btn profile-follow-btn${following ? " following" : ""}`;
      followBtn.textContent = following ? t("unfollow") : t("follow");
      followBtn.addEventListener("click", async () => {
        followBtn.disabled = true;
        try {
          if (following) {
            await unfollowUser(profile.username);
            following = false;
          } else {
            await followUser(profile.username);
            following = true;
          }
          followBtn.textContent = following ? t("unfollow") : t("follow");
          followBtn.classList.toggle("following", following);
        } catch { /* silent */ } finally {
          followBtn.disabled = false;
        }
      });
      headerInfo.appendChild(followBtn);
    }

    // Export JSON (own profile)
    if (isOwnProfile) {
      const exportBtn = document.createElement("button");
      exportBtn.className = "action-btn profile-export-btn";
      exportBtn.textContent = t("exportJson");
      exportBtn.addEventListener("click", () => {
        const data = JSON.stringify(profile.emotions, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `spectrum-${profile.username}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
      headerInfo.appendChild(exportBtn);
    }

    header.appendChild(avatarCanvas);
    header.appendChild(headerInfo);

    // ── Tabs ───────────────────────────────────────────────
    const tabs = document.createElement("div");
    tabs.className = "profile-tabs";

    const tabEmotions = document.createElement("button");
    tabEmotions.className = "profile-tab active";
    tabEmotions.textContent = t("myEmotions");

    const tabLiked = document.createElement("button");
    tabLiked.className = "profile-tab";
    tabLiked.textContent = t("likedTab");

    tabs.appendChild(tabEmotions);
    tabs.appendChild(tabLiked);

    // ── Grid ───────────────────────────────────────────────
    const grid = document.createElement("div");
    grid.className = "feed-grid";

    function showEmotions() {
      grid.innerHTML = "";
      if (profile.emotions.length === 0) {
        grid.innerHTML = `<div class="feed-empty">${t("noEmotions")}</div>`;
      } else {
        profile.emotions.forEach((e, i) => grid.appendChild(createCard(e, () => {}, i)));
      }
    }

    function showLiked() {
      grid.innerHTML = `<div class="feed-empty">${t("loading")}</div>`;
      getLikedEmotions(profile.username).then(feed => {
        grid.innerHTML = "";
        if (feed.items.length === 0) {
          grid.innerHTML = `<div class="feed-empty">${t("noEmotions")}</div>`;
        } else {
          feed.items.forEach((e, i) => grid.appendChild(createCard(e, () => {}, i)));
        }
      }).catch(() => {
        grid.innerHTML = `<div class="feed-empty">${t("notFound")}</div>`;
      });
    }

    tabEmotions.addEventListener("click", () => {
      tabEmotions.classList.add("active");
      tabLiked.classList.remove("active");
      showEmotions();
    });

    tabLiked.addEventListener("click", () => {
      tabLiked.classList.add("active");
      tabEmotions.classList.remove("active");
      showLiked();
    });

    showEmotions();

    wrap.appendChild(header);
    wrap.appendChild(tabs);
    wrap.appendChild(grid);
  }).catch(() => {
    wrap.innerHTML = `<div class="feed-empty">${t("notFound")}</div>`;
  });

  return () => {};
}
