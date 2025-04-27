const { jsPDF } = window.jspdf;
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const cameraBtn = document.getElementById("camera-btn");
const sendBtn = document.getElementById("send-btn");
const attachBtn = document.getElementById("attach-btn");
const mediaInput = document.getElementById("media-input");
const audioInput = document.getElementById("audio-input");
const imageInput = document.getElementById("image-input");
const documentInput = document.getElementById("document-input");
const voiceBtn = document.getElementById("voice-btn");
const reasoningBtn = document.getElementById("reasoning-btn");
const mediaPreview = document.getElementById("media-preview");
const previewImg = document.getElementById("preview-img");
const audioPlayer = document.getElementById("audio-player");
const documentName = document.getElementById("document-name");
const chatList = document.getElementById("chat-list");
const newChatBtn = document.getElementById("new-chat-btn");
const themeToggle = document.getElementById("theme-toggle");
const showTimestamps = document.getElementById("show-timestamps");
const exportChatBtn = document.getElementById("export-chat-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const typingIndicator = document.getElementById("typing-indicator");
const userTypingIndicator = document.getElementById("user-typing-indicator");
const chatSearch = document.getElementById("chat-search");
const messageSearch = document.getElementById("message-search");
const responseLanguage = document.getElementById("response-language");
const imagePrompt = document.getElementById("image-prompt");
const generateImageBtn = document.getElementById("generate-image-btn");
let conversationHistory = [];
let currentChatId = null;
let mediaType = null;
let isRecording = false;
let lastMessageTime = null;
let typingTimeout = null;
let rateLimitTimeout = null;
let mediaRecorder;
let audioChunks = [];
let audioBlob = null;
let reasoningState = "off";

// Utility to generate UUID
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Theme toggle
function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", newTheme);
  themeToggle.innerHTML =
    newTheme === "dark"
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';
  themeToggle.setAttribute("aria-label", `Switch to ${newTheme} theme`);
  localStorage.setItem("theme", newTheme);
}

// Load theme
function loadTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.body.setAttribute("data-theme", savedTheme);
  themeToggle.innerHTML =
    savedTheme === "dark"
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';
  themeToggle.setAttribute(
    "aria-label",
    `Switch to ${savedTheme === "dark" ? "light" : "dark"} theme`
  );
}

// Toggle timestamps
function toggleTimestamps() {
  const show = showTimestamps.checked;
  document.querySelectorAll(".message-meta").forEach((meta) => {
    meta.style.display = show ? "block" : "none";
  });
  localStorage.setItem("showTimestamps", show);
}

// Load timestamp preference
function loadTimestamps() {
  const show = localStorage.getItem("showTimestamps") !== "false";
  showTimestamps.checked = show;
  toggleTimestamps();
}

// Export chat as text
function exportChat() {
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  const session = sessions[currentChatId];
  if (!session) return;

  let exportText = `Grok AI Chatbot - Exported Chat (${new Date().toLocaleString()})\n\n`;
  session.history.forEach((msg) => {
    exportText += `${msg.role === "user" ? "User" : "Grok"} (${
      msg.meta || ""
    } - ${new Date(msg.timestamp).toLocaleString()}):\n${msg.content}\n`;
    if (msg.reactions && msg.reactions.length) {
      exportText += `Reactions: ${msg.reactions.join(" ")}\n`;
    }
    exportText += "\n";
  });

  const blob = new Blob([exportText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Grok_Chat_${new Date().toISOString().split("T")[0]}.txt`;
  a.setAttribute("aria-label", "Download chat as text file");
  a.click();
  URL.revokeObjectURL(url);
}

// Export chat as PDF
function exportChatAsPDF() {
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  const session = sessions[currentChatId];
  if (!session) return;

  const doc = new jsPDF();
  doc.setFontSize(12);
  let y = 20;

  doc.text(
    `Grok AI Chatbot - Exported Chat (${new Date().toLocaleString()})`,
    20,
    y
  );
  y += 10;

  session.history.forEach((msg) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const role = msg.role === "user" ? "User" : "Grok";
    const meta = msg.meta || "";
    const timestamp = new Date(msg.timestamp).toLocaleString();
    doc.text(`${role} (${meta} - ${timestamp}):`, 20, y);
    y += 7;

    const lines = doc.splitTextToSize(msg.content, 170);
    lines.forEach((line) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += 7;
    });

    if (msg.reactions && msg.reactions.length) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(`Reactions: ${msg.reactions.join(" ")}`, 20, y);
      y += 10;
    } else {
      y += 3;
    }
  });

  doc.save(`Grok_Chat_${new Date().toISOString().split("T")[0]}.pdf`);
}

// Search chats
function searchChats() {
  const query = chatSearch.value.toLowerCase();
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  chatList.innerHTML = "";
  const pinnedSessions = [];
  const regularSessions = [];

  Object.keys(sessions).forEach((id) => {
    const session = sessions[id];
    if (
      session.title.toLowerCase().includes(query) ||
      session.history.some((msg) => msg.content.toLowerCase().includes(query))
    ) {
      if (session.pinned) {
        pinnedSessions.push({ id, session });
      } else {
        regularSessions.push({ id, session });
      }
    }
  });

  pinnedSessions.concat(regularSessions).forEach(({ id, session }) => {
    addChatItem(id, session.title, id === currentChatId, session.pinned);
  });
}

// Search messages
function searchMessages() {
  const query = messageSearch.value.toLowerCase();
  document.querySelectorAll(".message").forEach((message) => {
    const content = message
      .querySelector(".message-content")
      .textContent.toLowerCase();
    message.style.display = content.includes(query) ? "flex" : "none";
  });
}

// Load chat sessions from localStorage
function loadChatSessions() {
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  chatList.innerHTML = "";
  const pinnedSessions = [];
  const regularSessions = [];

  Object.keys(sessions).forEach((id) => {
    const session = sessions[id];
    if (session.pinned) {
      pinnedSessions.push({ id, session });
    } else {
      regularSessions.push({ id, session });
    }
  });

  pinnedSessions.concat(regularSessions).forEach(({ id, session }) => {
    addChatItem(id, session.title, id === currentChatId, session.pinned);
  });
}

// Save chat session to localStorage
function saveChatSession(id, title, history, pinned = false) {
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  sessions[id] = { title, history, pinned };
  localStorage.setItem("chatSessions", JSON.stringify(sessions));
  loadChatSessions();
}

// Delete chat session
function deleteChatSession(id) {
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  delete sessions[id];
  localStorage.setItem("chatSessions", JSON.stringify(sessions));
  if (id === currentChatId) {
    startNewChat();
  }
  loadChatSessions();
}

// Pin/unpin chat session
function togglePinChat(id) {
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  if (sessions[id]) {
    sessions[id].pinned = !sessions[id].pinned;
    localStorage.setItem("chatSessions", JSON.stringify(sessions));
    loadChatSessions();
  }
}

// Add chat item to sidebar
function addChatItem(id, title, isActive = false, pinned = false) {
  const chatItem = document.createElement("div");
  chatItem.classList.add("chat-item");
  if (isActive) chatItem.classList.add("active");
  if (pinned) chatItem.classList.add("pinned");
  chatItem.innerHTML = `
    <span class="chat-item-title">${title}</span>
    <div class="chat-item-actions">
      <button class="chat-item-btn load" title="Load Chat" aria-label="Load Chat"><i class="fas fa-folder-open"></i></button>
      <button class="chat-item-btn pin" title="${
        pinned ? "Unpin" : "Pin"
      } Chat" aria-label="${
    pinned ? "Unpin" : "Pin"
  } Chat"><i class="fas fa-thumbtack"></i></button>
      <button class="chat-item-btn delete" title="Delete Chat" aria-label="Delete Chat"><i class="fas fa-trash"></i></button>
    </div>
  `;
  chatItem.querySelector(".load").addEventListener("click", () => loadChat(id));
  chatItem
    .querySelector(".pin")
    .addEventListener("click", () => togglePinChat(id));
  chatItem
    .querySelector(".delete")
    .addEventListener("click", () => deleteChatSession(id));
  chatList.appendChild(chatItem);
}

// Start a new chat
function startNewChat() {
  currentChatId = generateUUID();
  conversationHistory = [];
  chatMessages.innerHTML = "";
  messageSearch.value = "";
  chatInput.value = "";
  saveChatSession(currentChatId, `Chat ${new Date().toLocaleString()}`, []);
  loadDraft();
}

// Load a chat
function loadChat(id) {
  const sessions = JSON.parse(localStorage.getItem("chatSessions") || "{}");
  const session = sessions[id];
  if (session) {
    currentChatId = id;
    conversationHistory = session.history;
    chatMessages.innerHTML = "";
    session.history.forEach((msg) => {
      addMessage(
        msg.content,
        msg.role,
        msg.meta || "",
        msg.timestamp,
        msg.reactions || []
      );
    });
    loadChatSessions();
    messageSearch.value = "";
    searchMessages();
    loadDraft();
  }
}

// Save draft message
function saveDraft() {
  const draft = chatInput.value.trim();
  localStorage.setItem(`draft_${currentChatId}`, draft);
}

// Load draft message
function loadDraft() {
  const draft = localStorage.getItem(`draft_${currentChatId}`) || "";
  chatInput.value = draft;
}

// Show user typing indicator
function showUserTyping() {
  clearTimeout(typingTimeout);
  userTypingIndicator.style.display = "block";
  typingTimeout = setTimeout(() => {
    userTypingIndicator.style.display = "none";
  }, 3000);
}

// Render Markdown content
function renderMarkdown(content) {
  return DOMPurify.sanitize(marked.parse(content));
}

// Add message to chat
function addMessage(
  content,
  role,
  meta = "",
  timestamp = Date.now(),
  reactions = []
) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", role);
  const formattedContent = renderMarkdown(content);
  messageDiv.innerHTML = `
    <div class="avatar">${role === "user" ? "U" : "G"}</div>
    <div class="message-content">${formattedContent}</div>
    <div class="message-meta" data-timestamp="${timestamp}">${meta} • ${new Date(
    timestamp
  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    <div class="message-actions">
      <button class="copy-btn" title="Copy Message" aria-label="Copy Message"><i class="fas fa-copy"></i></button>
      ${
        role === "user"
          ? `<button class="edit-btn" title="Edit Message" aria-label="Edit Message"><i class="fas fa-edit"></i></button>`
          : ""
      }
      <button class="reaction-btn" title="Add Reaction" aria-label="Add Reaction"><i class="fas fa-smile"></i></button>
    </div>
    <div class="reactions"></div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Add reactions
  const reactionsDiv = messageDiv.querySelector(".reactions");
  reactions.forEach((reaction) => {
    const reactionSpan = document.createElement("span");
    reactionSpan.classList.add("reaction", "active");
    reactionSpan.textContent = reaction;
    reactionSpan.addEventListener("click", () =>
      toggleReaction(messageDiv, reaction)
    );
    reactionsDiv.appendChild(reactionSpan);
  });

  // Copy button
  messageDiv.querySelector(".copy-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(content);
    showToast("Message copied to clipboard!");
  });

  // Edit button
  if (role === "user") {
    const editBtn = messageDiv.querySelector(".edit-btn");
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      editBtn.disabled = true;
      editBtn.style.opacity = "0.5";
    } else {
      editBtn.addEventListener("click", () =>
        editMessage(messageDiv, content, timestamp)
      );
    }
  }

  // Reaction button
  messageDiv.querySelector(".reaction-btn").addEventListener("click", () => {
    const emojis = ["👍", "❤️", "😂", "😮", "😢"];
    const existingReactions = reactionsDiv.querySelectorAll(".reaction").length;
    if (existingReactions >= 5) {
      showToast("Maximum 5 reactions allowed.");
      return;
    }
    const reaction = emojis[Math.floor(Math.random() * emojis.length)];
    toggleReaction(messageDiv, reaction);
  });

  conversationHistory.push({ role, content, meta, timestamp, reactions });
  toggleTimestamps();
}

// Toggle reaction
function toggleReaction(messageDiv, emoji) {
  const reactionsDiv = messageDiv.querySelector(".reactions");
  const existingReaction = reactionsDiv.querySelector(
    `.reaction[data-emoji="${emoji}"]`
  );
  const messageIndex = Array.from(chatMessages.children).indexOf(messageDiv);

  if (existingReaction) {
    // If the emoji is already present, remove it (toggle off)
    existingReaction.remove();
    conversationHistory[messageIndex].reactions = conversationHistory[
      messageIndex
    ].reactions.filter((r) => r !== emoji);
  } else {
    // Clear existing reactions (allow only one reaction at a time)
    reactionsDiv.innerHTML = "";
    conversationHistory[messageIndex].reactions = [];

    // Add the new reaction
    const reactionSpan = document.createElement("span");
    reactionSpan.classList.add("reaction");
    reactionSpan.setAttribute("data-emoji", emoji);
    reactionSpan.textContent = emoji;
    reactionsDiv.appendChild(reactionSpan);
    conversationHistory[messageIndex].reactions.push(emoji);
  }

  // Update the chat session storage
  saveChatSession(
    currentChatId,
    conversationHistory[0]?.content?.substring(0, 30) ||
      `Chat ${new Date().toLocaleString()}`,
    conversationHistory
  );
}

// Edit message
function editMessage(messageDiv, originalContent, timestamp) {
  if (Date.now() - timestamp > 5 * 60 * 1000) {
    showToast("Cannot edit messages older than 5 minutes.");
    return;
  }

  const contentDiv = messageDiv.querySelector(".message-content");
  contentDiv.innerHTML = `
    <textarea class="edit-input">${originalContent}</textarea>
    <div class="edit-actions">
      <button class="edit-save">Save</button>
      <button class="edit-cancel">Cancel</button>
    </div>
  `;

  const editInput = contentDiv.querySelector(".edit-input");
  editInput.focus();

  contentDiv.querySelector(".edit-save").addEventListener("click", () => {
    const newContent = editInput.value.trim();
    if (newContent) {
      contentDiv.innerHTML = renderMarkdown(newContent);
      const index = conversationHistory.findIndex(
        (msg) => msg.timestamp === timestamp
      );
      if (index !== -1) {
        conversationHistory[index].content = newContent;
        saveChatSession(
          currentChatId,
          conversationHistory[0]?.content?.substring(0, 30) ||
            `Chat ${new Date().toLocaleString()}`,
          conversationHistory
        );
      }
    } else {
      showToast("Message cannot be empty.");
    }
  });

  contentDiv.querySelector(".edit-cancel").addEventListener("click", () => {
    contentDiv.innerHTML = renderMarkdown(originalContent);
  });
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.backgroundColor = "#36393f";
  toast.style.color = "white";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "4px";
  toast.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Show error with retry
function showError(elementId, message, retryCallback = null) {
  const errorDiv = document.getElementById(elementId);
  errorDiv.textContent = message;
  if (retryCallback) {
    const retryBtn = document.createElement("button");
    retryBtn.classList.add("retry-btn");
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", retryCallback);
    errorDiv.appendChild(retryBtn);
  }
  errorDiv.style.display = "block";
}

// Show rate limit error with timer
function showRateLimitError(elementId, retryAfter, retryCallback) {
  const errorDiv = document.getElementById(elementId);
  errorDiv.innerHTML = `Rate limit exceeded. Retrying in <span class="rate-limit-timer">${retryAfter}</span> seconds.`;
  errorDiv.style.display = "block";

  let timeLeft = retryAfter;
  const timer = setInterval(() => {
    timeLeft--;
    errorDiv.querySelector(".rate-limit-timer").textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timer);
      errorDiv.style.display = "none";
      retryCallback();
    }
  }, 1000);
}

// Update media preview
function updatePreview(type, src, name, description) {
  mediaPreview.innerHTML = "";
  const previewItem = document.createElement("div");
  previewItem.classList.add("preview-item");
  previewItem.innerHTML = `
    <i class="fas fa-${
      type === "image" ? "image" : type === "audio" ? "music" : "file"
    } preview-icon"></i>
    <div class="preview-content">
      <h4>${name}</h4>
      <p>${description}</p>
    </div>
    <button class="preview-remove" title="Remove ${type}" aria-label="Remove ${type}"><i class="fas fa-times"></i></button>
  `;
  if (type === "image") {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Preview";
    previewItem.insertBefore(
      img,
      previewItem.querySelector(".preview-content")
    );
  } else if (type === "audio") {
    const audio = document.createElement("audio");
    audio.src = src;
    audio.controls = true;
    previewItem.insertBefore(
      audio,
      previewItem.querySelector(".preview-content")
    );
  }
  mediaPreview.appendChild(previewItem);
  mediaPreview.style.display = "flex";

  previewItem.querySelector(".preview-remove").addEventListener("click", () => {
    mediaPreview.innerHTML = "";
    mediaPreview.style.display = "none";
    mediaType = null;
    audioInput.value = "";
    imageInput.value = "";
    documentInput.value = "";
    audioBlob = null;
    document.getElementById("image-processing-mode").style.display = "none";
  });
}

// Get file extension
function getFileExtension(filename) {
  return filename
    .slice(((filename.lastIndexOf(".") - 1) >>> 0) + 1)
    .toLowerCase();
}

// Process text
function processText(message, retry = false) {
  const apiKey = document.getElementById("api-key").value;
  const language = responseLanguage.value;
  const reasoning = reasoningState !== "off";
  const useAgentic = reasoningState === "agentic";

  if (!apiKey) {
    showError("text-error", "Please enter your Groq API key", () =>
      processText(message, true)
    );
    return;
  }

  if (!message) {
    showError("text-error", "Please enter some text");
    return;
  }

  document.getElementById("chat-loading").style.display = "block";
  typingIndicator.style.display = "block";
  document.getElementById("text-error").style.display = "none";

  if (reasoning) {
    fetch("/process_text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `Please respond in ${language}: ${message}`,
        api_key: apiKey,
        reasoning: true,
        agentic: useAgentic,
        history: conversationHistory,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After") || 60;
            showRateLimitError("text-error", parseInt(retryAfter), () =>
              processText(message, true)
            );
            throw new Error("Rate limit exceeded");
          }
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let messageDiv = null;

        function readStream() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                document.getElementById("chat-loading").style.display = "none";
                typingIndicator.style.display = "none";
                if (messageDiv) {
                  saveChatSession(
                    currentChatId,
                    conversationHistory[0]?.content?.substring(0, 30) ||
                      `Chat ${new Date().toLocaleString()}`,
                    conversationHistory
                  );
                }
                return;
              }

              const chunk = decoder.decode(value);
              const lines = chunk.split("\n\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const dataStr = line.slice(6);
                  if (dataStr === "[DONE]") continue;

                  try {
                    const data = JSON.parse(dataStr);
                    if (data.error) {
                      throw new Error(data.error);
                    }
                    const content = data.choices?.[0]?.delta?.content || "";
                    if (content) {
                      accumulatedContent += content
                        .replace(/\\n/g, "\n")
                        .replace(/\\r/g, "\r")
                        .replace(/\\"/g, '"');
                      if (!messageDiv) {
                        messageDiv = document.createElement("div");
                        messageDiv.classList.add("message", "bot");
                        messageDiv.innerHTML = `
                          <div class="avatar">G</div>
                          <div class="message-content"></div>
                          <div class="message-meta" data-timestamp="${Date.now()}">${
                          useAgentic ? "Agentic Response" : "Reasoning Response"
                        } • ${new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}</div>
                          <div class="message-actions">
                            <button class="copy-btn" title="Copy Message" aria-label="Copy Message"><i class="fas fa-copy"></i></button>
                            <button class="reaction-btn" title="Add Reaction" aria-label="Add Reaction"><i class="fas fa-smile"></i></button>
                          </div>
                          <div class="reactions"></div>
                        `;
                        chatMessages.appendChild(messageDiv);
                        conversationHistory.push({
                          role: "bot",
                          content: "",
                          meta: useAgentic
                            ? "Agentic Response"
                            : "Reasoning Response",
                          timestamp: Date.now(),
                          reactions: [],
                        });
                      }
                      messageDiv.querySelector(".message-content").innerHTML =
                        renderMarkdown(accumulatedContent);
                      chatMessages.scrollTop = chatMessages.scrollHeight;
                      conversationHistory[
                        conversationHistory.length - 1
                      ].content = accumulatedContent;

                      messageDiv
                        .querySelector(".copy-btn")
                        .addEventListener("click", () => {
                          navigator.clipboard.writeText(accumulatedContent);
                          showToast("Message copied to clipboard!");
                        });

                      // Updated reaction button to show picker
                      messageDiv
                        .querySelector(".reaction-btn")
                        .addEventListener("click", (e) => {
                          e.stopPropagation(); // Prevent click from bubbling
                          showEmojiPicker(
                            messageDiv,
                            messageDiv.querySelector(".reaction-btn")
                          );
                        });
                    }
                  } catch (e) {
                    console.error(
                      "Error parsing stream data:",
                      e,
                      "Raw data:",
                      dataStr
                    );
                    showError(
                      "text-error",
                      `Error processing ${
                        useAgentic ? "agentic" : "reasoning"
                      } response: ${e.message}`,
                      () => processText(message, true)
                    );
                    reader.cancel();
                    return;
                  }
                }
              }
              readStream();
            })
            .catch((e) => {
              document.getElementById("chat-loading").style.display = "none";
              typingIndicator.style.display = "none";
              showError("text-error", `Stream error: ${e.message}`, () =>
                processText(message, true)
              );
            });
        }
        readStream();
      })
      .catch((error) => {
        document.getElementById("chat-loading").style.display = "none";
        typingIndicator.style.display = "none";
        if (!retry) {
          showError(
            "text-error",
            `Error initiating stream: ${error.message}`,
            () => processText(message, true)
          );
        }
      });
  } else {
    fetch("/process_text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `Please respond in ${language}: ${message}`,
        api_key: apiKey,
        history: conversationHistory,
      }),
    })
      .then((response) => {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After") || 60;
          showRateLimitError("text-error", parseInt(retryAfter), () =>
            processText(message, true)
          );
          throw new Error("Rate limit exceeded");
        }
        return response.json();
      })
      .then((data) => {
        document.getElementById("chat-loading").style.display = "none";
        typingIndicator.style.display = "none";

        if (data.error) {
          showError("text-error", data.error, () => processText(message, true));
        } else {
          addMessage(data.response, "bot");
          const messageDiv = chatMessages.lastElementChild; // Get the newly added message
          // Update the reaction button for non-reasoning mode
          messageDiv
            .querySelector(".reaction-btn")
            .addEventListener("click", (e) => {
              e.stopPropagation();
              showEmojiPicker(
                messageDiv,
                messageDiv.querySelector(".reaction-btn")
              );
            });
          saveChatSession(
            currentChatId,
            conversationHistory[0]?.content?.substring(0, 30) ||
              `Chat ${new Date().toLocaleString()}`,
            conversationHistory
          );
        }
      })
      .catch((error) => {
        document.getElementById("chat-loading").style.display = "none";
        typingIndicator.style.display = "none";
        if (!retry) {
          showError(
            "text-error",
            `Error processing request: ${error.message}`,
            () => processText(message, true)
          );
        }
      });
  }
}

// Process image
function processImage(retry = false) {
  const imageInput = document.getElementById("image-input");
  const apiKey = document.getElementById("api-key").value;
  const language = responseLanguage.value;
  const processingMode = document.getElementById("image-processing-mode").value;

  if (!apiKey) {
    showError("image-error", "Please enter your Groq API key", () =>
      processImage(true)
    );
    return;
  }

  if (!imageInput.files || imageInput.files.length === 0) {
    showError("image-error", "Please select an image");
    return;
  }

  document.getElementById("chat-loading").style.display = "block";
  typingIndicator.style.display = "block";
  document.getElementById("image-error").style.display = "none";

  const formData = new FormData();
  formData.append("image", imageInput.files[0]);
  formData.append("api_key", apiKey);
  formData.append("processing_mode", processingMode);

  fetch("/process_image", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After") || 60;
        showRateLimitError("image-error", parseInt(retryAfter), () =>
          processImage(true)
        );
        throw new Error("Rate limit exceeded");
      }
      return response.json();
    })
    .then((data) => {
      document.getElementById("chat-loading").style.display = "none";
      typingIndicator.style.display = "none";

      if (data.error) {
        showError("image-error", data.error, () => processImage(true));
      } else {
        if (processingMode === "ocr") {
          addMessage(data.extracted_text, "bot", "Extracted Text");
          fetch("/process_text", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: `Please respond in ${language}: ${data.extracted_text}`,
              api_key: apiKey,
              history: conversationHistory,
            }),
          })
            .then((response) => {
              if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After") || 60;
                showRateLimitError("image-error", parseInt(retryAfter), () =>
                  processImage(true)
                );
                throw new Error("Rate limit exceeded");
              }
              return response.json();
            })
            .then((data) => {
              if (data.error) {
                showError("image-error", data.error, () => processImage(true));
              } else {
                addMessage(data.response, "bot", "Response");
                saveChatSession(
                  currentChatId,
                  conversationHistory[0]?.content?.substring(0, 30) ||
                    `Chat ${new Date().toLocaleString()}`,
                  conversationHistory
                );
              }
            })
            .catch((error) => {
              showError(
                "image-error",
                `Error processing response: ${error.message}`,
                () => processImage(true)
              );
            });
        } else {
          addMessage(data.description, "bot", "Image Description");
          saveChatSession(
            currentChatId,
            conversationHistory[0]?.content?.substring(0, 30) ||
              `Chat ${new Date().toLocaleString()}`,
            conversationHistory
          );
        }
      }
      document.getElementById("image-processing-mode").style.display = "none";
    })
    .catch((error) => {
      document.getElementById("chat-loading").style.display = "none";
      typingIndicator.style.display = "none";
      if (!retry) {
        showError(
          "image-error",
          `Error processing request: ${error.message}`,
          () => processImage(true)
        );
      }
      document.getElementById("image-processing-mode").style.display = "none";
    });
}

// Process document
function processDocument(retry = false) {
  const documentInput = document.getElementById("document-input");
  const apiKey = document.getElementById("api-key").value;
  const language = responseLanguage.value;

  if (!apiKey) {
    showError("document-error", "Please enter your Groq API key", () =>
      processDocument(true)
    );
    return;
  }

  if (!documentInput.files || documentInput.files.length === 0) {
    showError("document-error", "Please select a document");
    return;
  }

  document.getElementById("chat-loading").style.display = "block";
  typingIndicator.style.display = "block";
  document.getElementById("document-error").style.display = "none";

  const formData = new FormData();
  formData.append("document", documentInput.files[0]);
  formData.append("api_key", apiKey);

  fetch("/process_document", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After") || 60;
        showRateLimitError("document-error", parseInt(retryAfter), () =>
          processDocument(true)
        );
        throw new Error("Rate limit exceeded");
      }
      return response.json();
    })
    .then((data) => {
      document.getElementById("chat-loading").style.display = "none";
      typingIndicator.style.display = "none";

      if (data.error) {
        showError("document-error", data.error, () => processDocument(true));
      } else {
        if (data.summary && data.document_text) {
          addMessage(data.summary, "bot", "Document Summary");
          addMessage(data.document_text, "bot", "Content Preview");
        } else if (data.extracted_text) {
          addMessage(data.extracted_text, "bot", "Extracted Text");
          fetch("/process_text", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: `Please respond in ${language}: ${data.extracted_text}`,
              api_key: apiKey,
              history: conversationHistory,
            }),
          })
            .then((response) => {
              if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After") || 60;
                showRateLimitError("document-error", parseInt(retryAfter), () =>
                  processDocument(true)
                );
                throw new Error("Rate limit exceeded");
              }
              return response.json();
            })
            .then((data) => {
              if (data.error) {
                showError("document-error", data.error, () =>
                  processDocument(true)
                );
              } else {
                addMessage(data.response, "bot", "Response");
              }
            })
            .catch((error) => {
              showError(
                "document-error",
                `Error processing response: ${error.message}`,
                () => processDocument(true)
              );
            });
        } else {
          showError(
            "document-error",
            "Unexpected response format from server",
            () => processDocument(true)
          );
        }

        saveChatSession(
          currentChatId,
          conversationHistory[0]?.content?.substring(0, 30) ||
            `Chat ${new Date().toLocaleString()}`,
          conversationHistory
        );
      }
    })
    .catch((error) => {
      document.getElementById("chat-loading").style.display = "none";
      typingIndicator.style.display = "none";
      if (!retry) {
        showError(
          "document-error",
          `Error processing request: ${error.message}`,
          () => processDocument(true)
        );
      }
    });
}

// Process Pokémon image
async function processPokemonImage(prompt, isRandom = false, retry = false) {
  const apiKey = document.getElementById("api-key").value;
  const display = document.getElementById("pokemon-image");

  if (!apiKey) {
    showError("image-gen-error", "Please enter your Groq API key", () =>
      processPokemonImage(prompt, isRandom, true)
    );
    return;
  }

  display.classList.add("loading");
  display.innerHTML = "Loading...";

  try {
    let pokemonIdOrName = prompt?.toLowerCase().trim();
    if (isRandom) {
      pokemonIdOrName = Math.floor(Math.random() * 1025) + 1;
    }

    if (!pokemonIdOrName) {
      throw new Error("Please enter a Pokémon name or ID");
    }

    const res = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${pokemonIdOrName}`
    );
    if (!res.ok) throw new Error("Pokémon not found");
    const data = await res.json();
    const image = data.sprites.front_default;
    const pokemonName = data.name;

    display.classList.remove("loading");
    display.innerHTML = "";

    const messageContent = isRandom
      ? `Generated random Pokémon: ${pokemonName} (ID: ${pokemonIdOrName})`
      : `Generated Pokémon: ${pokemonName}`;
    const messageMeta = isRandom ? "Random Pokémon" : "Pokémon Image";
    addMessage(messageContent, "bot", messageMeta);

    const img = document.createElement("img");
    img.src = image;
    img.alt = `Pokémon: ${pokemonName}`;
    img.style.width = "150px";
    img.style.height = "150px";
    img.style.objectFit = "contain";
    img.classList.add("generated-image");

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "bot");
    messageDiv.innerHTML = `
      <div class="avatar">G</div>
      <div class="message-content"></div>
      <div class="message-meta">${messageMeta} • ${new Date().toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    )}</div>
      <div class="message-actions">
        <button class="copy-btn" title="Copy Message" aria-label="Copy Message"><i class="fas fa-copy"></i></button>
        <button class="reaction-btn" title="Add Reaction" aria-label="Add Reaction"><i class="fas fa-smile"></i></button>
      </div>
      <div class="reactions"></div>
    `;
    messageDiv.querySelector(".message-content").appendChild(img);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    conversationHistory.push({
      role: "bot",
      content: isRandom
        ? `[Random Pokémon: ${pokemonName} (ID: ${pokemonIdOrName})]`
        : `[Pokémon: ${pokemonName}]`,
      meta: messageMeta,
      timestamp: Date.now(),
      reactions: [],
    });

    saveChatSession(
      currentChatId,
      conversationHistory[0]?.content?.substring(0, 30) ||
        `Chat ${new Date().toLocaleString()}`,
      conversationHistory
    );

    messageDiv.querySelector(".copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(messageContent);
      showToast("Message copied to clipboard!");
    });

    messageDiv.querySelector(".reaction-btn").addEventListener("click", () => {
      const emojis = ["👍", "❤️", "😂", "😮", "😢"];
      const reactionsDiv = messageDiv.querySelector(".reactions");
      const existingReactions =
        reactionsDiv.querySelectorAll(".reaction").length;
      if (existingReactions >= 5) {
        showToast("Maximum 5 reactions allowed.");
        return;
      }
      const reaction = emojis[Math.floor(Math.random() * emojis.length)];
      toggleReaction(messageDiv, reaction);
    });
  } catch (error) {
    display.classList.remove("loading");
    display.innerHTML = `<p style="color:red;">${error.message}</p>`;
    showError(
      "image-gen-error",
      `Error fetching Pokémon: ${error.message}`,
      () => processPokemonImage(prompt, isRandom, true)
    );
  }
}

// Process voice
function processVoice(retry = false) {
  const apiKey = document.getElementById("api-key").value;
  const language = responseLanguage.value;

  if (!apiKey) {
    showError("voice-error", "Please enter your Groq API key", () =>
      processVoice(true)
    );
    return;
  }

  if (!audioBlob) {
    showError("voice-error", "Please record or upload an audio file");
    return;
  }

  document.getElementById("chat-loading").style.display = "block";
  typingIndicator.style.display = "block";
  document.getElementById("voice-error").style.display = "none";

  const formData = new FormData();
  formData.append("audio", audioBlob);
  formData.append("api_key", apiKey);

  fetch("/process_audio", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After") || 60;
        showRateLimitError("voice-error", parseInt(retryAfter), () =>
          processVoice(true)
        );
        throw new Error("Rate limit exceeded");
      }
      return response.json();
    })
    .then((data) => {
      document.getElementById("chat-loading").style.display = "none";
      typingIndicator.style.display = "none";

      if (data.error) {
        showError("voice-error", data.error, () => processVoice(true));
      } else {
        addMessage(data.transcription, "bot", "Voice Transcription");
        fetch("/process_text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: `Please respond in ${language}: ${data.transcription}`,
            api_key: apiKey,
            history: conversationHistory,
          }),
        })
          .then((response) => {
            if (response.status === 429) {
              const retryAfter = response.headers.get("Retry-After") || 60;
              showRateLimitError("voice-error", parseInt(retryAfter), () =>
                processVoice(true)
              );
              throw new Error("Rate limit exceeded");
            }
            return response.json();
          })
          .then((data) => {
            if (data.error) {
              showError("voice-error", data.error, () => processVoice(true));
            } else {
              addMessage(data.response, "bot", "Response");
              saveChatSession(
                currentChatId,
                conversationHistory[0]?.content?.substring(0, 30) ||
                  `Chat ${new Date().toLocaleString()}`,
                conversationHistory
              );
            }
          })
          .catch((error) => {
            showError(
              "voice-error",
              `Error processing response: ${error.message}`,
              () => processVoice(true)
            );
          });
      }
    })
    .catch((error) => {
      document.getElementById("chat-loading").style.display = "none";
      typingIndicator.style.display = "none";
      if (!retry) {
        showError(
          "voice-error",
          `Error processing request: ${error.message}`,
          () => processVoice(true)
        );
      }
    });
}

// Send message
function sendMessage() {
  if (rateLimitTimeout) {
    showToast("Please wait, rate limit in effect.");
    return;
  }

  const message = chatInput.value.trim();
  const processingModeSelect = document.getElementById("image-processing-mode");
  if (message || mediaType) {
    if (message) {
      addMessage(message, "user");
      processText(message);
      chatInput.value = "";
      saveDraft();
      adjustChatInputHeight();
    }
    if (mediaType === "image") {
      processImage();
    } else if (mediaType === "audio") {
      processVoice();
    } else if (mediaType === "document") {
      processDocument();
    }
    mediaPreview.innerHTML = "";
    mediaPreview.style.display = "none";
    mediaType = null;
    audioInput.value = "";
    imageInput.value = "";
    documentInput.value = "";
    audioBlob = null;
    processingModeSelect.style.display = "none";
  } else {
    showError("chat-error", "Please enter a message or attach a file");
  }
}

// Adjust textarea height
function adjustChatInputHeight() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
}

function showEmojiPicker(messageDiv, reactionBtn) {
  // Remove any existing picker to avoid duplicates
  const existingPicker = document.querySelector(".emoji-picker");
  if (existingPicker) {
    existingPicker.remove();
  }

  // Create the picker
  const picker = document.createElement("div");
  picker.classList.add("emoji-picker");

  // Define the emojis (same as in the image)
  const emojis = ["👍", "❤️", "😂", "😮", "😢", "🙏", "😭"];

  // Create a button for each emoji
  emojis.forEach((emoji) => {
    const button = document.createElement("button");
    button.textContent = emoji;
    button.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent the click from closing the picker immediately
      toggleReaction(messageDiv, emoji);
      picker.remove(); // Close the picker after selection
    });
    picker.appendChild(button);
  });

  // Position the picker relative to the reaction button
  reactionBtn.parentElement.appendChild(picker);

  // Close the picker if clicking outside
  const closePicker = (e) => {
    if (!picker.contains(e.target) && e.target !== reactionBtn) {
      picker.remove();
      document.removeEventListener("click", closePicker);
    }
  };
  document.addEventListener("click", closePicker);
}

// Open camera modal
function openCameraModal() {
  const modal = document.createElement("div");
  modal.classList.add("camera-modal");
  modal.innerHTML = `
    <video id="camera-preview" autoplay playsinline></video>
    <div class="camera-modal-buttons">
      <button class="camera-btn capture" aria-label="Capture Photo">Capture</button>
      <button class="camera-btn cancel" aria-label="Cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);

  const video = modal.querySelector("#camera-preview");
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      video.srcObject = stream;
      modal.style.display = "flex";
    })
    .catch((error) => {
      showError("image-error", `Error accessing camera: ${error.message}`);
      modal.remove();
    });

  modal
    .querySelector(".capture")
    .addEventListener("click", () => captureImage(modal, video));
  modal
    .querySelector(".cancel")
    .addEventListener("click", () => closeCameraModal(modal));
}

// Close camera modal
function closeCameraModal(modal) {
  const video = modal.querySelector("#camera-preview");
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  modal.remove();
}

// Capture image from camera
function captureImage(modal, video) {
  const canvas = document.getElementById("camera-canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    imageInput.files = dataTransfer.files;
    imageInput.dispatchEvent(new Event("change", { bubbles: true }));
    mediaType = "image";
    updatePreview(
      "image",
      canvas.toDataURL("image/jpeg"),
      file.name,
      "Camera Capture"
    );
    document.getElementById("image-processing-mode").style.display = "block";
    closeCameraModal(modal);
  }, "image/jpeg");
}

// Setup event listeners
function setupEventListeners() {
  themeToggle.addEventListener("click", toggleTheme);
  newChatBtn.addEventListener("click", startNewChat);
  showTimestamps.addEventListener("change", toggleTimestamps);
  exportChatBtn.addEventListener("click", exportChat);
  exportPdfBtn.addEventListener("click", exportChatAsPDF);
  chatSearch.addEventListener("input", searchChats);
  messageSearch.addEventListener("input", searchMessages);

  chatInput.addEventListener("input", () => {
    showUserTyping();
    saveDraft();
    adjustChatInputHeight();
  });

  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    } else if (event.ctrlKey && event.key === "e") {
      const lastUserMessage = conversationHistory
        .slice()
        .reverse()
        .find((msg) => msg.role === "user");
      if (lastUserMessage) {
        const messageDiv = Array.from(
          document.querySelectorAll(".message.user")
        )
          .reverse()
          .find(
            (div) =>
              parseInt(div.querySelector(".message-meta").dataset.timestamp) ===
              lastUserMessage.timestamp
          );
        if (messageDiv) {
          editMessage(
            messageDiv,
            lastUserMessage.content,
            lastUserMessage.timestamp
          );
        }
      }
    }
  });

  cameraBtn.addEventListener("click", () => {
    openCameraModal();
  });

  sendBtn.addEventListener("click", sendMessage);

  attachBtn.addEventListener("click", () => mediaInput.click());

  mediaInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    const processingModeSelect = document.getElementById(
      "image-processing-mode"
    );
    if (!file) {
      processingModeSelect.style.display = "none";
      return;
    }

    const extension = getFileExtension(file.name);
    if (file.type.startsWith("image/")) {
      imageInput.files = event.target.files;
      imageInput.dispatchEvent(new Event("change", { bubbles: true }));
      mediaType = "image";
      processingModeSelect.style.display = "block";
    } else if (file.type.startsWith("audio/")) {
      audioInput.files = event.target.files;
      audioInput.dispatchEvent(new Event("change", { bubbles: true }));
      mediaType = "audio";
      processingModeSelect.style.display = "none";
    } else if ([".pdf", ".docx", ".txt", ".md", ".csv"].includes(extension)) {
      documentInput.files = event.target.files;
      documentInput.dispatchEvent(new Event("change", { bubbles: true }));
      mediaType = "document";
      processingModeSelect.style.display = "none";
    } else {
      showError("chat-error", `Unsupported file format: ${extension}`);
      processingModeSelect.style.display = "none";
    }
  });

  voiceBtn.addEventListener("click", function () {
    if (isRecording) {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        voiceBtn.classList.remove("recording");
        isRecording = false;
      }
    } else {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.addEventListener("dataavailable", (event) => {
            audioChunks.push(event.data);
          });

          mediaRecorder.addEventListener("stop", () => {
            audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            updatePreview(
              "audio",
              audioUrl,
              "recording.wav",
              "Audio Recording"
            );
            mediaType = "audio";
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(
              new File([audioBlob], "recording.wav", { type: "audio/wav" })
            );
            audioInput.files = dataTransfer.files;
            const event = new Event("change", { bubbles: true });
            audioInput.dispatchEvent(event);
          });

          mediaRecorder.start();
          voiceBtn.classList.add("recording");
          isRecording = true;
        })
        .catch((error) => {
          showError(
            "voice-error",
            `Error accessing microphone: ${error.message}`
          );
        });
    }
  });

  audioInput.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        showError("voice-error", "Invalid audio file format");
        return;
      }
      audioBlob = file;
      const audioUrl = URL.createObjectURL(file);
      audioPlayer.src = audioUrl;
      updatePreview("audio", audioUrl, file.name, "Audio File");
    }
  });

  imageInput.addEventListener("change", function (event) {
    const file = event.target.files[0];
    const processingModeSelect = document.getElementById(
      "image-processing-mode"
    );
    if (file) {
      if (!file.type.startsWith("image/")) {
        showError("image-error", "Invalid image file format");
        processingModeSelect.style.display = "none";
        return;
      }
      const imageUrl = URL.createObjectURL(file);
      previewImg.src = imageUrl;
      updatePreview("image", imageUrl, file.name, "Image File");
      processingModeSelect.style.display = "block";
    } else {
      processingModeSelect.style.display = "none";
    }
  });

  documentInput.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      const validExtensions = [".pdf", ".docx", ".txt", ".md", ".csv"];
      const extension = getFileExtension(file.name);
      if (!validExtensions.includes(extension)) {
        showError("document-error", `Unsupported file format: ${extension}`);
        return;
      }
      documentName.textContent = file.name;
      updatePreview(
        "document",
        null,
        file.name,
        file.type.split("/")[1].toUpperCase() + " Document"
      );
    }
  });

  generateImageBtn.addEventListener("click", () => {
    const prompt = imagePrompt.value.trim();
    if (prompt) {
      processPokemonImage(prompt);
    } else {
      showError("image-gen-error", "Please enter a Pokémon name or ID");
    }
  });

  // reasoningBtn.addEventListener("click", () => {
  //   reasoningBtn.classList.toggle("active");
  //   reasoningBtn.title = reasoningBtn.classList.contains("active")
  //     ? "Disable Reasoning"
  //     : "Enable Reasoning";
  //   reasoningBtn.setAttribute(
  //     "aria-label",
  //     reasoningBtn.classList.contains("active")
  //       ? "Disable Reasoning"
  //       : "Enable Reasoning"
  //   );
  // });

  reasoningBtn.addEventListener("click", () => {
    if (reasoningState === "off") {
      reasoningState = "normal";
      reasoningBtn.classList.add("active");
      reasoningBtn.classList.remove("agentic");
      reasoningBtn.title = "Enable Agentic Mode (Web Search)";
      reasoningBtn.setAttribute(
        "aria-label",
        "Enable Agentic Mode (Web Search)"
      );
    } else if (reasoningState === "normal") {
      reasoningState = "agentic";
      reasoningBtn.classList.add("active", "agentic");
      reasoningBtn.title = "Disable Reasoning";
      reasoningBtn.setAttribute("aria-label", "Disable Reasoning");
    } else {
      reasoningState = "off";
      reasoningBtn.classList.remove("active", "agentic");
      reasoningBtn.title = "Enable Reasoning";
      reasoningBtn.setAttribute("aria-label", "Enable Reasoning");
    }
  });

  document
    .getElementById("random-pokemon-btn")
    .addEventListener("click", () => {
      processPokemonImage(null, true);
    });
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  loadTimestamps();
  loadChatSessions();
  startNewChat();
  setupEventListeners();
});
