<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import Panel from "primevue/panel";
import Button from "primevue/button";
import Textarea from "primevue/textarea";
import { useChatStore } from "@/stores/chat";

// Chat with the "explain-labs_claude" bot (built specifically for this project).
// State + the /api/chat call live in the chat store; this is just the
// conversation UI. Assistant text is rendered as plain text for now (no markdown
// lib in the app yet).

const chat = useChatStore();
const input = ref("");
const scrollEnd = ref<HTMLDivElement | null>(null);

async function send() {
  const text = input.value;
  if (!text.trim() || chat.isLoading) return;
  input.value = "";
  await chat.sendMessage(text);
}

// Enter sends, Shift+Enter inserts a newline.
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

// auto-scroll to the newest message / the loading indicator
watch(
  () => [chat.messages.length, chat.isLoading],
  async () => {
    await nextTick();
    scrollEnd.value?.scrollIntoView({ behavior: "smooth" });
  },
);
</script>

<template>
  <Panel toggleable>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-semibold">Explain Labs</span>
        <Button
          v-tooltip.top="'New conversation'"
          icon="pi pi-plus"
          text
          rounded
          size="small"
          aria-label="New conversation"
          @click="chat.newConversation()"
        />
      </div>
    </template>

    <div class="flex flex-col gap-2">
      <!-- conversation -->
      <div class="h-80 overflow-y-auto rounded border border-surface-700 p-2 flex flex-col gap-2">
        <p v-if="!chat.messages.length" class="text-xs opacity-50 m-auto text-center">
          Ask Explain Labs about the current patient.
        </p>
        <div
          v-for="(m, i) in chat.messages"
          :key="i"
          :class="[
            'max-w-[85%] rounded px-2 py-1 text-sm whitespace-pre-wrap break-words',
            m.role === 'user'
              ? 'self-end bg-primary-700 text-white'
              : m.failed
                ? 'self-start bg-red-900/60 text-red-100'
                : 'self-start bg-surface-800',
          ]"
        >
          {{ m.text }}
        </div>
        <div v-if="chat.isLoading" class="self-start text-xs opacity-60 px-2 py-1">
          <i class="pi pi-spin pi-spinner mr-1"></i> thinking…
        </div>
        <div ref="scrollEnd"></div>
      </div>

      <!-- composer -->
      <div class="flex items-end gap-2">
        <Textarea
          v-model="input"
          placeholder="Ask about the patient…  (Enter to send, Shift+Enter for newline)"
          rows="2"
          auto-resize
          class="flex-1 text-sm"
          :disabled="chat.isLoading"
          @keydown="onKeydown"
        />
        <Button
          icon="pi pi-send"
          aria-label="Send"
          :disabled="!input.trim() || chat.isLoading"
          @click="send"
        />
      </div>

      <p v-if="chat.error" class="text-[11px] text-red-400 leading-tight">
        {{ chat.error }}
      </p>
    </div>
  </Panel>
</template>
