import { getUserProfile, getFollowers, getFollowing, isLoggedIn, followUser, unfollowUser, getLikedEmotions, updateBio, updateAvatar, getFeed, sendMessage, getCollections } from "./api";
import { createCard } from "./card";
import { getUsername } from "./state";
import { t } from "./i18n";
import { emotionPreviewStyle } from "./card";
import { createCollectionCard } from "./collections";
import { drawAvatar } from "./avatar";

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

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "profile-avatar-wrap";

    let avatarEl: HTMLElement;
    if (profile.avatar) {
      const img = document.createElement("img");
      img.src = profile.avatar;
      img.className = "profile-avatar profile-avatar-img";
      avatarEl = img;
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = 80; canvas.height = 80;
      canvas.className = "profile-avatar";
      drawAvatar(canvas, profile.username);
      avatarEl = canvas;
    }
    avatarWrap.appendChild(avatarEl);

    const isOwnProfileForAvatar = getUsername() === profile.username;
    if (isOwnProfileForAvatar) {
      const overlay = document.createElement("div");
      overlay.className = "profile-avatar-overlay";
      overlay.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
      avatarWrap.appendChild(overlay);

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        overlay.style.opacity = "1";
        try {
          const dataUrl = await resizeImageToSquare(file, 96);
          await updateAvatar(profile.username, dataUrl);
          const newImg = document.createElement("img");
          newImg.src = dataUrl;
          newImg.className = "profile-avatar profile-avatar-img";
          avatarEl.replaceWith(newImg);
          avatarEl = newImg;
        } catch { /* silent */ } finally {
          overlay.style.opacity = "";
        }
      });
      avatarWrap.addEventListener("click", () => fileInput.click());
      avatarWrap.appendChild(fileInput);
    }

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

    // Send emotion button (only for other logged-in users)
    if (isLoggedIn() && !isOwnProfile) {
      const sendBtn = document.createElement("button");
      sendBtn.className = "action-btn profile-send-btn";
      sendBtn.textContent = t("sendEmotion");
      sendBtn.addEventListener("click", () => openSendModal(profile.username, app));
      headerInfo.appendChild(sendBtn);
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

    header.appendChild(avatarWrap);
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

    const tabFollowers = document.createElement("button");
    tabFollowers.className = "profile-tab";
    tabFollowers.textContent = `${t("followersTab")} (${profile.followers_count})`;

    const tabFollowing = document.createElement("button");
    tabFollowing.className = "profile-tab";
    tabFollowing.textContent = `${t("followingTab")} (${profile.following_count})`;

    const tabCollections = document.createElement("button");
    tabCollections.className = "profile-tab";
    tabCollections.textContent = t("collections");

    tabs.appendChild(tabEmotions);
    tabs.appendChild(tabLiked);
    tabs.appendChild(tabFollowers);
    tabs.appendChild(tabFollowing);
    tabs.appendChild(tabCollections);

    // ── Grid ───────────────────────────────────────────────
    const grid = document.createElement("div");
    grid.className = "feed-grid";

    const allTabs = [tabEmotions, tabLiked, tabFollowers, tabFollowing, tabCollections];
    function setActive(tab: HTMLButtonElement) {
      allTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    }

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

    function showUserList(fetchFn: () => Promise<{ username: string }[]>) {
      grid.innerHTML = `<div class="feed-empty">${t("loading")}</div>`;
      fetchFn().then(users => {
        grid.innerHTML = "";
        if (users.length === 0) {
          grid.innerHTML = `<div class="feed-empty">${t("noEmotions")}</div>`;
          return;
        }
        users.forEach(u => {
          const row = document.createElement("div");
          row.className = "profile-user-row";
          const av = document.createElement("canvas");
          av.width = 32; av.height = 32;
          av.className = "avatar-canvas";
          drawAvatar(av, u.username);
          const link = document.createElement("a");
          link.href = `#/profile/${u.username}`;
          link.className = "profile-user-row-name";
          link.textContent = u.username;
          row.appendChild(av);
          row.appendChild(link);
          grid.appendChild(row);
        });
      }).catch(() => {
        grid.innerHTML = `<div class="feed-empty">${t("notFound")}</div>`;
      });
    }

    function showCollections() {
      grid.innerHTML = `<div class="feed-empty">${t("loading")}</div>`;
      getCollections(profile.username).then(colls => {
        grid.innerHTML = "";
        if (!colls.length) {
          grid.innerHTML = `<div class="feed-empty">${t("noCollections")}</div>`;
          return;
        }
        const collGrid = document.createElement("div");
        collGrid.className = "collections-grid";
        colls.forEach(c => collGrid.appendChild(createCollectionCard(c)));
        grid.appendChild(collGrid);
      }).catch(() => {
        grid.innerHTML = `<div class="feed-empty">${t("notFound")}</div>`;
      });
    }

    tabEmotions.addEventListener("click", () => { setActive(tabEmotions); showEmotions(); });
    tabLiked.addEventListener("click", () => { setActive(tabLiked); showLiked(); });
    tabFollowers.addEventListener("click", () => {
      setActive(tabFollowers);
      showUserList(() => getFollowers(profile.username));
    });
    tabFollowing.addEventListener("click", () => {
      setActive(tabFollowing);
      showUserList(() => getFollowing(profile.username));
    });
    tabCollections.addEventListener("click", () => { setActive(tabCollections); showCollections(); });

    showEmotions();

    wrap.appendChild(header);
    wrap.appendChild(tabs);
    wrap.appendChild(grid);
  }).catch(() => {
    wrap.innerHTML = `<div class="feed-empty">${t("notFound")}</div>`;
  });

  return () => {};
}

function openSendModal(toUsername: string, container: HTMLElement) {
  const overlay = document.createElement("div");
  overlay.className = "send-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "send-modal";

  const title = document.createElement("div");
  title.className = "send-modal-title";
  title.textContent = `${t("sendEmotion")} → ${toUsername}`;

  const list = document.createElement("div");
  list.className = "send-modal-list";
  list.textContent = t("loading");

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "action-btn";
  cancelBtn.textContent = t("backToFeed").replace("←", "").trim();
  cancelBtn.addEventListener("click", () => overlay.remove());

  modal.appendChild(title);
  modal.appendChild(list);
  modal.appendChild(cancelBtn);
  overlay.appendChild(modal);
  container.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  const myName = getUsername()!;
  getFeed({ author: myName, limit: 50 }).then(feed => {
    list.innerHTML = "";
    if (!feed.items.length) {
      list.innerHTML = `<div class="send-modal-empty">${t("noEmotions")}</div>`;
      return;
    }
    feed.items.forEach(emotion => {
      const item = document.createElement("div");
      item.className = "send-modal-item";

      const preview = document.createElement("div");
      preview.className = "send-modal-preview";
      if (emotion.thumbnail) {
        const img = document.createElement("img");
        img.src = emotion.thumbnail;
        img.className = "send-modal-thumb";
        preview.appendChild(img);
      } else {
        preview.setAttribute("style", emotionPreviewStyle(emotion.parameters));
      }

      const label = document.createElement("span");
      label.className = "send-modal-label";
      label.textContent = emotion.emotion_type || "—";

      const sendBtn = document.createElement("button");
      sendBtn.className = "action-btn send-modal-send";
      sendBtn.textContent = t("sendBtn");
      sendBtn.addEventListener("click", async () => {
        sendBtn.disabled = true;
        try {
          await sendMessage(toUsername, emotion.id);
          sendBtn.textContent = t("messageSent");
          setTimeout(() => overlay.remove(), 1000);
        } catch {
          sendBtn.disabled = false;
        }
      });

      item.appendChild(preview);
      item.appendChild(label);
      item.appendChild(sendBtn);
      list.appendChild(item);
    });
  }).catch(() => {
    list.textContent = t("notFound");
  });
}

function resizeImageToSquare(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const s = Math.min(img.width, img.height);
        const ox = (img.width - s) / 2;
        const oy = (img.height - s) / 2;
        ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
