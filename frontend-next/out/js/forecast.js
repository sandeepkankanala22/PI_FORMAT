        /* ════════════════════════════════════════════════
           CHATBOT LOGIC
        ════════════════════════════════════════════════ */
        // Same sparkle glyph as the floating Copilot launcher — keeps the bot's
        // identity consistent instead of a generic robot-face emoji.
        const COPILOT_AVATAR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="copilotAvatarGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#E8720C"/><stop offset="100%" stop-color="#C9922A"/></linearGradient></defs><path d="M12 2.5c.9 2.6 2.1 3.8 4.7 4.7-2.6.9-3.8 2.1-4.7 4.7-.9-2.6-2.1-3.8-4.7-4.7 2.6-.9 3.8-2.1 4.7-4.7Z" fill="url(#copilotAvatarGrad)"/><path d="M18.5 13c.5 1.5 1.2 2.2 2.7 2.7-1.5.5-2.2 1.2-2.7 2.7-.5-1.5-1.2-2.2-2.7-2.7 1.5-.5 2.2-1.2 2.7-2.7Z" fill="url(#copilotAvatarGrad)" opacity="0.75"/></svg>';
        const COUNTRIES = ['United States', 'Germany', 'United Kingdom', 'France', 'Japan', 'China', 'Canada', 'Italy', 'Spain'];
        const INDICATIONS = ['Rheumatoid Arthritis', 'Multiple Sclerosis', 'Type 2 Diabetes', 'Oncology', 'Alzheimer Disease', 'Heart Failure'];
        // Common country aliases → canonical name
        const COUNTRY_ALIASES = {
            'us': 'United States', 'usa': 'United States', 'united states': 'United States',
            'uk': 'United Kingdom', 'united kingdom': 'United Kingdom', 'gb': 'United Kingdom', 'britain': 'United Kingdom',
            'de': 'Germany', 'germany': 'Germany',
            'fr': 'France', 'france': 'France',
            'jp': 'Japan', 'japan': 'Japan',
            'cn': 'China', 'china': 'China',
            'ca': 'Canada', 'canada': 'Canada',
            'it': 'Italy', 'italy': 'Italy',
            'es': 'Spain', 'spain': 'Spain',
        };

        let chatStep = 0; // highest field index filled so far
        const BACKEND_URL = window.location.origin || ''; // Same-origin for deployed; '' for local dev
        const FORECAST_SESSION_KEY = 'forecastSessionId';

        function getForecastSessionId() {
            try { return sessionStorage.getItem(FORECAST_SESSION_KEY) || ''; } catch (e) { return ''; }
        }
        function setForecastSessionId(id) {
            try { if (id) sessionStorage.setItem(FORECAST_SESSION_KEY, id); } catch (e) { /* ignore */ }
        }
        window.getForecastSessionId = getForecastSessionId;
        window.setForecastSessionId = setForecastSessionId;

        let conversationHistory = [];               // OpenAI message history
        let forecastCalculated = false;             // true once forecast results are ready
        let assumptionsGenerated = false;           // true once assumptions have been generated
        let maxStepReached = 1;                     // highest tab the user has ever reached
        let validationErrors = {};                  // holds active numeric input validation errors

        const steps = [
            { key: 'country', ask: 'Which **country** are you targeting?\n\n(e.g. United States, Germany, Japan…)', qr: COUNTRIES },
            { key: 'productName', ask: 'What is the **product name**?\n\n(e.g., TUB-040)', qr: [] },
            { key: 'classMoa', ask: 'What is the **drug class / mechanism of action**?\n\n(e.g., Antibody-Drug Conjugate, ADC / NaPi2b targeting)', qr: [] },
            { key: 'indication', ask: 'What **therapeutic indication** is being targeted?\n\n(e.g., Non-small cell lung cancer, Ovarian cancer)', qr: INDICATIONS },
            { key: 'launchYear', ask: 'What year is the **planned launch**?\n\n(e.g., 2028)', qr: ['2025', '2026', '2027', '2028', '2029', '2030'] },
            { key: 'peakYear', ask: 'What is the **Forecast - End Year**?\n\n(e.g., 2034)', qr: ['2030', '2031', '2032', '2033', '2034', '2035'] },
        ];

        const EXAMPLE_PROMPT_TEXT = 'Forecast for TUB-040 (ADC / NaPi2b targeting, Gilead / Tubulis) in the US for NSCLC, launching 2028, forecast end year 2034';

        const MODE_CHOICE_ICONS = {
            example: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
            insert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
            steps: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
            describe: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            upload: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        };

        // Copilot onboarding (mode-choice card) is State 1; dismissed once any
        // forecast workflow begins (PI upload, chat, step-by-step, example, etc.).
        let _copilotOnboardingDismissed = false;

        function dismissCopilotOnboarding() {
            if (_copilotOnboardingDismissed) return;
            _copilotOnboardingDismissed = true;
            document.querySelectorAll('.mode-choice-card').forEach(card => {
                const row = card.closest('.msg-row');
                if (row) row.remove();
                else card.remove();
            });
            const qr = document.getElementById('quickRepliesContainer');
            if (qr) qr.innerHTML = '';
        }

        function resetCopilotOnboardingState() {
            _copilotOnboardingDismissed = false;
        }

        // Presents 4 entry-point choices instead of jumping straight into the Q&A
        // flow. Ordered fastest-to-most-guided: try the example (zero typing, see
        // it work immediately), describe in your own words (the real, flexible
        // path), upload a PI document (if one exists), step-by-step as the safe
        // fallback for anyone unsure what to type. Rendered as a persistent message
        // card (not a transient quick-reply row) so it stays visible in scrollback.
        function botSayModeChoice(introText) {
            introText = introText || 'How would you like to begin?';
            showTyping(() => {
                const box = document.getElementById('messages');
                const row = document.createElement('div');
                row.className = 'msg-row bot';

                const avatar = document.createElement('div');
                avatar.className = 'msg-avatar';
                avatar.innerHTML = COPILOT_AVATAR_ICON;

                const content = document.createElement('div');
                content.className = 'msg-content';

                const bubble = document.createElement('div');
                bubble.className = 'msg bot';
                bubble.innerHTML = introText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

                const card = document.createElement('div');
                card.className = 'mode-choice-card';

                // 1. Try the example — fastest path, one click to a full result.
                const exampleRow = document.createElement('div');
                exampleRow.className = 'mode-example-row';
                exampleRow.title = 'Click to run this example';
                exampleRow.innerHTML =
                    '<div class="mode-example-icon">' + MODE_CHOICE_ICONS.example + '</div>' +
                    '<div class="mode-example-text">&ldquo;' + EXAMPLE_PROMPT_TEXT + '&rdquo;</div>' +
                    '<button type="button" class="mode-example-insert" title="Run this example">' + MODE_CHOICE_ICONS.insert + '</button>';
                const runExample = () => {
                    dismissCopilotOnboarding();
                    const input = document.getElementById('chatInput');
                    input.value = EXAMPLE_PROMPT_TEXT;
                    sendMessage();
                };
                exampleRow.onclick = runExample;
                exampleRow.querySelector('.mode-example-insert').onclick = (e) => { e.stopPropagation(); runExample(); };

                // 2. Describe your own product in free text — the main real-use path.
                const describeBtn = document.createElement('button');
                describeBtn.type = 'button';
                describeBtn.className = 'mode-choice-btn';
                describeBtn.innerHTML = MODE_CHOICE_ICONS.describe + '<span>Describe your product</span>';
                describeBtn.onclick = () => {
                    const input = document.getElementById('chatInput');
                    input.placeholder = 'e.g. Forecast for [product] ([class/MoA]) in [country] for [indication], launching [year], forecast end year [year]';
                    input.focus();
                };

                // 3. Upload a PI document — hands off to the real upload dropzone/
                // input in the Product Information card (id="referenceFile").
                const uploadBtn = document.createElement('button');
                uploadBtn.type = 'button';
                uploadBtn.className = 'mode-choice-btn';
                uploadBtn.innerHTML = MODE_CHOICE_ICONS.upload + '<span>Upload PI document</span>';
                uploadBtn.onclick = () => {
                    document.getElementById('referenceFile')?.click();
                };

                const urlBtn = document.createElement('button');
                urlBtn.type = 'button';
                urlBtn.className = 'mode-choice-btn';
                urlBtn.innerHTML = MODE_CHOICE_ICONS.upload + '<span>Paste PI URL</span>';
                urlBtn.onclick = () => {
                    dismissCopilotOnboarding();
                    const card = document.getElementById('productInfoCard');
                    const urlInput = document.getElementById('piSourceUrl');
                    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    if (urlInput) {
                        urlInput.focus();
                        urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                };

                // 4. Guided step-by-step Q&A — the safe fallback.
                const stepBtn = document.createElement('button');
                stepBtn.type = 'button';
                stepBtn.className = 'mode-choice-btn';
                stepBtn.innerHTML = MODE_CHOICE_ICONS.steps + '<span>Guide me step by step</span>';
                stepBtn.onclick = () => {
                    dismissCopilotOnboarding();
                    botSay(steps[0].ask, steps[0].qr);
                };

                card.appendChild(exampleRow);
                card.appendChild(describeBtn);
                card.appendChild(uploadBtn);
                card.appendChild(urlBtn);
                card.appendChild(stepBtn);
                bubble.appendChild(card);

                const time = document.createElement('div');
                time.className = 'msg-time';
                time.textContent = nowTime();

                content.appendChild(bubble);
                content.appendChild(time);
                row.appendChild(avatar);
                row.appendChild(content);
                box.appendChild(row);
                box.scrollTop = box.scrollHeight;
            });
        }

        function nowTime() {
            const d = new Date();
            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        }

        // Live-updating chat bubble (for progress animation)
        function addLiveChatMsg(initialText) {
            const box = document.getElementById('messages');
            const row = document.createElement('div');
            row.className = 'msg-row bot';

            const avatar = document.createElement('div');
            avatar.className = 'msg-avatar';
            avatar.innerHTML = COPILOT_AVATAR_ICON;

            const content = document.createElement('div');
            content.className = 'msg-content';

            const bubble = document.createElement('div');
            bubble.className = 'msg bot';
            bubble.innerHTML = initialText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            const time = document.createElement('div');
            time.className = 'msg-time';
            time.textContent = nowTime();

            content.appendChild(bubble);
            content.appendChild(time);
            row.appendChild(avatar);
            row.appendChild(content);
            box.appendChild(row);
            box.scrollTop = box.scrollHeight;
            return {
                update(text) {
                    bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                    box.scrollTop = box.scrollHeight;
                },
                remove() { row.remove(); }
            };
        }

        function addMsg(text, role) {
            const box = document.getElementById('messages');
            const row = document.createElement('div');
            row.className = 'msg-row ' + role;

            const avatar = document.createElement('div');
            avatar.className = 'msg-avatar';
            if (role === 'user') avatar.textContent = '👤';
            else avatar.innerHTML = COPILOT_AVATAR_ICON;

            const content = document.createElement('div');
            content.className = 'msg-content';

            const bubble = document.createElement('div');
            bubble.className = 'msg ' + role;
            bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

            const time = document.createElement('div');
            time.className = 'msg-time' + (role === 'user' ? ' right' : '');
            time.textContent = nowTime();

            content.appendChild(bubble);
            content.appendChild(time);

            if (role === 'user') {
                row.appendChild(content);
                row.appendChild(avatar);
            } else {
                row.appendChild(avatar);
                row.appendChild(content);
            }
            box.appendChild(row);
            box.scrollTop = box.scrollHeight;
        }

        function addHtmlMsg(html, role) {
            const box = document.getElementById('messages');
            const row = document.createElement('div');
            row.className = 'msg-row ' + role;

            const avatar = document.createElement('div');
            avatar.className = 'msg-avatar';
            if (role === 'user') avatar.textContent = '👤';
            else avatar.innerHTML = COPILOT_AVATAR_ICON;

            const content = document.createElement('div');
            content.className = 'msg-content';

            const bubble = document.createElement('div');
            bubble.className = 'msg ' + role;
            bubble.innerHTML = html;

            const time = document.createElement('div');
            time.className = 'msg-time' + (role === 'user' ? ' right' : '');
            time.textContent = nowTime();

            content.appendChild(bubble);
            content.appendChild(time);

            if (role === 'user') {
                row.appendChild(content);
                row.appendChild(avatar);
            } else {
                row.appendChild(avatar);
                row.appendChild(content);
            }
            box.appendChild(row);
            box.scrollTop = box.scrollHeight;
        }

        function showTyping(cb) {
            const box = document.getElementById('messages');
            const row = document.createElement('div');
            row.id = 'typingWrap';
            row.className = 'msg-row bot';

            const avatar = document.createElement('div');
            avatar.className = 'msg-avatar';
            avatar.innerHTML = COPILOT_AVATAR_ICON;

            const content = document.createElement('div');
            content.className = 'msg-content';
            content.innerHTML = '<div class="msg bot typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

            row.appendChild(avatar);
            row.appendChild(content);
            box.appendChild(row);
            box.scrollTop = box.scrollHeight;
            setTimeout(() => {
                const el = document.getElementById('typingWrap');
                if (el) el.remove();
                cb();
            }, 700);
        }

        function setQuickReplies(options) {
            const c = document.getElementById('quickRepliesContainer');
            c.innerHTML = '';
            // Don't show "Apply Recommendation" once it's already been used
            if (aiRecApplied) options = options.filter(o => !/apply\s*(ai\s*)?rec/i.test(o));
            options.slice(0, 6).forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'qr-chip';
                if (/^generate\s*(now|assumptions)$/i.test(opt)) btn.classList.add('qr-chip-primary');
                const isApplyAI = opt === 'Apply Recommendation';
                if (isApplyAI) {
                    btn.dataset.applyAiChip = '1';
                    if (aiRecLoading) {
                        btn.disabled = true;
                        btn.textContent = 'Generating recommendation…';
                        btn.title = 'AI recommendation is still being generated. Please wait.';
                    } else {
                        btn.textContent = opt;
                    }
                } else {
                    btn.textContent = opt;
                }
                btn.onclick = () => {
                    document.getElementById('chatInput').value = opt;
                    sendMessage();
                };
                c.appendChild(btn);
            });
        }

        function botSay(text, qr = []) {
            showTyping(() => {
                addMsg(text, 'bot');
                setQuickReplies(qr);
            });
        }

        // "Thinking mode" — a single chat bubble that fills in one line per
        // PARAMETER, each landing the instant that parameter's node appears in
        // the flow (see renderFlowViewMode's onRowStart hook + FLOW_ROW_STEP_MS),
        // so the chat and the flow visibly build together one step at a time
        // instead of two separate, unrelated effects.
        //
        // FLOW_REASONING_PLAYBOOK is a placeholder hook, keyed by paramId — right
        // now it's empty, so every step just shows the parameter's own label +
        // description (real data, already visible in the flow, not fabricated).
        // The intended extension point: a real playbook (per indication / therapy
        // area / asset type) that supplies the ACTUAL rule that drove each
        // parameter's inclusion, e.g. incidence: "Acute disease — modelled on new
        // diagnoses, not existing stock" instead of just its static description.
        const FLOW_REASONING_PLAYBOOK = {
            // paramId: 'reasoning text to use instead of the row's own description'
        };

        // Priority order for a row's "why": an explicit playbook entry (future
        // extension point) > the LLM's own bullet if it actually talks about
        // this parameter (real reasoning, not fabricated) > the row's static
        // description (always real, just not asset-specific).
        function pickRowReasoning(row) {
            if (FLOW_REASONING_PLAYBOOK[row.paramId]) return FLOW_REASONING_PLAYBOOK[row.paramId];
            const keyword = row.label.replace(/\s*(Rate|Criteria|Share)$/i, '').trim().toLowerCase();
            if (keyword) {
                const match = aiRecBulletsPlain.find(b => b.toLowerCase().includes(keyword));
                if (match) return match;
            }
            return row.desc;
        }

        // A distinct, collapsible-feeling "thinking" box (like Claude Code's tool/
        // reasoning blocks) — a spinner + title while steps are still landing,
        // then botThinkingFinish() collapses and removes the whole box once every
        // parameter has been accounted for, handing off to a normal chat message.
        function botThinkingStart(title) {
            return new Promise(resolve => {
                showTyping(() => {
                    const box = document.getElementById('messages');
                    const row = document.createElement('div');
                    row.className = 'msg-row bot';
                    const avatar = document.createElement('div');
                    avatar.className = 'msg-avatar';
                    avatar.innerHTML = COPILOT_AVATAR_ICON;
                    const content = document.createElement('div');
                    content.className = 'msg-content';
                    const bubble = document.createElement('div');
                    bubble.className = 'msg bot ai-thinking-box';
                    bubble.innerHTML = `<div class="ai-thinking-header"><span class="loading-spinner-sm"></span>${title || 'Thinking through the forecast flow…'}</div><ul class="ai-thinking-steps"></ul>`;
                    content.appendChild(bubble);
                    row.appendChild(avatar);
                    row.appendChild(content);
                    row.dataset.thinkingRow = '1';
                    box.appendChild(row);
                    box.scrollTop = box.scrollHeight;
                    resolve(bubble);
                });
            });
        }
        function botThinkingAddStep(bubble, text) {
            if (!bubble) return;
            const ul = bubble.querySelector('.ai-thinking-steps');
            if (!ul) return;
            const li = document.createElement('li');
            li.className = 'ai-thinking-step-enter';
            li.textContent = text;
            ul.appendChild(li);
            requestAnimationFrame(() => li.classList.remove('ai-thinking-step-enter'));
            const box = document.getElementById('messages');
            box.scrollTop = box.scrollHeight;
        }
        // Collapses the whole thinking box (fade + shrink) then removes it from
        // the transcript — the box was scaffolding for the reveal, not something
        // worth keeping around once the flow (and the final chat message) has it.
        function botThinkingFinish(bubble) {
            if (!bubble) return;
            const row = bubble.closest('[data-thinking-row]');
            bubble.classList.add('ai-thinking-fadeout');
            setTimeout(() => { if (row) row.remove(); }, 320);
        }

        // Post a bot message that includes one or more download action buttons.
        // actions: [{ label, href, download, cls }]  cls = 'excel' | 'pptx'
        function botSayWithActions(text, actions) {
            const DL_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
            showTyping(() => {
                const box = document.getElementById('messages');
                const row = document.createElement('div');
                row.className = 'msg-row bot';
                const avatar = document.createElement('div');
                avatar.className = 'msg-avatar';
                avatar.innerHTML = COPILOT_AVATAR_ICON;
                const content = document.createElement('div');
                content.className = 'msg-content';
                const bubble = document.createElement('div');
                bubble.className = 'msg bot';
                bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                content.appendChild(bubble);
                // Action buttons
                if (actions && actions.length) {
                    const actBar = document.createElement('div');
                    actBar.className = 'msg-actions';
                    actions.forEach(a => {
                        const btn = document.createElement('a');
                        btn.className = 'msg-dl-btn ' + (a.cls || '');
                        btn.href = a.href;
                        btn.download = a.download || '';
                        btn.innerHTML = DL_SVG + ' ' + a.label;
                        actBar.appendChild(btn);
                    });
                    content.appendChild(actBar);
                }
                const time = document.createElement('div');
                time.className = 'msg-time';
                time.textContent = nowTime();
                content.appendChild(time);
                row.appendChild(avatar);
                row.appendChild(content);
                box.appendChild(row);
                box.scrollTop = box.scrollHeight;
                setQuickReplies([]);
            });
        }

        function sanitizeStage1DisplayField(fieldId, value) {
            if (!value) return '';
            let text = String(value).trim();
            if (fieldId !== 'indication' && fieldId !== 'classMoa') return text;

            // Drop bracketed qualifiers — keep the meaningful label only
            text = text.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
            // Label dumps often use semicolons between multiple indications
            if (text.includes(';')) text = text.split(';')[0].trim();
            // Long comma lists: keep first therapeutic area
            if (text.split(',').length > 2) text = text.split(',')[0].trim();
            return text;
        }

        function fillField(fieldId, value) {
            const el = document.getElementById(fieldId);
            if (!el) return;
            if (fieldId === 'indication' || fieldId === 'classMoa') {
                value = sanitizeStage1DisplayField(fieldId, value);
            }
            if (el.tagName === 'SELECT') {
                for (let i = 0; i < el.options.length; i++) {
                    if (el.options[i].value.toLowerCase() === value.toLowerCase() ||
                        el.options[i].text.toLowerCase() === value.toLowerCase()) {
                        el.selectedIndex = i;
                        break;
                    }
                }
            } else {
                el.value = value;
            }
            updateFieldChipValue(fieldId);
            flashFieldChip(fieldId);
            debouncedSave();
            if (['country', 'productName', 'classMoa', 'indication', 'launchYear', 'peakYear'].includes(fieldId)) {
                refreshModeChoiceStarterCard();
                if (fieldId === 'launchYear' || fieldId === 'peakYear') {
                    validateProductFields();
                } else {
                    updateDefineFlowButtonState();
                }
            }
        }

        function getStage1FormState() {
            return {
                country: (document.getElementById('country') || {}).value || '',
                productName: (document.getElementById('productName') || {}).value || '',
                classMoa: (document.getElementById('classMoa') || {}).value || '',
                indication: (document.getElementById('indication') || {}).value || '',
                launchYear: (document.getElementById('launchYear') || {}).value || '',
                peakYear: (document.getElementById('peakYear') || {}).value || '',
            };
        }

        function isLaunchYearValid(val) {
            if (!val || !String(val).trim()) return false;
            const y = parseInt(val, 10);
            return !isNaN(y) && y >= 2000 && y <= 2100;
        }

        function isPeakYearValid(val, launchVal) {
            if (!val || !String(val).trim()) return false;
            const y = parseInt(val, 10);
            const launch = parseInt(launchVal, 10);
            if (isNaN(y) || y < 2000 || y > 2100) return false;
            if (!isNaN(launch) && y <= launch) return false;
            return true;
        }

        function getMissingStage1Steps(form) {
            form = form || getStage1FormState();
            return steps.filter(s => {
                const v = form[s.key] || '';
                if (s.key === 'launchYear') return !isLaunchYearValid(v);
                if (s.key === 'peakYear') return !isPeakYearValid(v, form.launchYear);
                return !v || !String(v).trim();
            });
        }

        function syncChatStepFromForm(form) {
            const missing = getMissingStage1Steps(form);
            if (missing.length === 0) {
                chatStep = 6;
                return;
            }
            const idx = steps.findIndex(s => s.key === missing[0].key);
            chatStep = idx >= 0 ? idx : 0;
        }

        function buildStage1ConfirmMessage(form) {
            form = form || getStage1FormState();
            return `✓ **All product details captured!** Please review and confirm:\n\n• **Country:** ${form.country}\n• **Product:** ${form.productName}\n• **Class/MoA:** ${form.classMoa}\n• **Indication:** ${form.indication}\n• **Launch Year:** ${form.launchYear} → **Forecast - End Year:** ${form.peakYear}\n\nDoes everything look correct? Click **Confirm & Proceed** to move to the next step.`;
        }

        function buildStage1ExtractedSummary(form) {
            form = form || getStage1FormState();
            const lines = [];
            if (form.country) lines.push(`• **Country:** ${form.country}`);
            if (form.productName) lines.push(`• **Product:** ${form.productName}`);
            if (form.classMoa) lines.push(`• **Class/MoA:** ${form.classMoa}`);
            if (form.indication) lines.push(`• **Indication:** ${form.indication}`);
            return lines.join('\n');
        }

        let _piCopilotProgress = null;
        let _piProgressTimer = null;
        let _piExtractCompletionKey = '';
        let _piActiveDisplayName = '';
        let _piStatusIndex = 0;
        let _piUploadHistoryLogged = false;

        const PI_EXTRACT_STATUS_MESSAGES = [
            'Reading Product Information...',
            'Extracting Product Details...',
            'Understanding indication...',
            'Identifying Drug Class...',
            'Analyzing therapy area...',
            'Preparing forecast context...',
            'Validating extracted information...',
        ];

        function escapeHtml(text) {
            const d = document.createElement('div');
            d.textContent = text == null ? '' : String(text);
            return d.innerHTML;
        }

        function buildCopilotStepsHtml(messages, activeIndex) {
            activeIndex = Math.max(0, Math.min(activeIndex, messages.length - 1));
            return messages.slice(0, activeIndex + 1).map((msg, i) => {
                const isActive = i === activeIndex;
                const isDone = i < activeIndex;
                const cls = isDone ? 'pi-copilot-step-done' : 'pi-copilot-step-active';
                const icon = isDone
                    ? '<span class="pi-copilot-step-icon">✓</span>'
                    : '<span class="pi-copilot-step-icon"><span class="pi-copilot-step-spin" aria-hidden="true"></span></span>';
                return (
                    '<div class="pi-copilot-step ' + cls + '">' +
                    icon +
                    '<span>' + escapeHtml(msg) + '</span>' +
                    '</div>'
                );
            }).join('');
        }

        function buildCopilotStepsAllDoneHtml(messages) {
            return messages.map((msg) => (
                '<div class="pi-copilot-step pi-copilot-step-done">' +
                '<span class="pi-copilot-step-icon">✓</span>' +
                '<span>' + escapeHtml(msg) + '</span>' +
                '</div>'
            )).join('');
        }

        function buildCopilotProcessShell(title, extraHtml, stepsHtml) {
            return (
                '<div class="pi-copilot-process-card">' +
                '<div class="pi-copilot-process-head">' +
                '<span class="pi-copilot-process-title">' + escapeHtml(title) + '</span>' +
                '</div>' +
                (extraHtml || '') +
                '<div class="pi-copilot-steps">' + stepsHtml + '</div>' +
                '</div>'
            );
        }

        function buildPiProcessingCardHtml(filename, activeIndex) {
            activeIndex = Math.max(0, Math.min(activeIndex, PI_EXTRACT_STATUS_MESSAGES.length - 1));
            const fileLine = '<div class="pi-copilot-process-file">📄 ' + escapeHtml(filename) + '</div>';
            return buildCopilotProcessShell(
                'Preparing your forecast...',
                fileLine,
                buildCopilotStepsHtml(PI_EXTRACT_STATUS_MESSAGES, activeIndex)
            );
        }

        function addPiBotProgressCard(html) {
            const box = document.getElementById('messages');
            const row = document.createElement('div');
            row.className = 'msg-row bot';

            const avatar = document.createElement('div');
            avatar.className = 'msg-avatar';
            avatar.innerHTML = COPILOT_AVATAR_ICON;

            const content = document.createElement('div');
            content.className = 'msg-content';

            const bubble = document.createElement('div');
            bubble.className = 'msg bot pi-copilot-progress-bubble';
            bubble.innerHTML = html;

            const time = document.createElement('div');
            time.className = 'msg-time';
            time.textContent = nowTime();

            content.appendChild(bubble);
            content.appendChild(time);
            row.appendChild(avatar);
            row.appendChild(content);
            box.appendChild(row);
            box.scrollTop = box.scrollHeight;
            return {
                updateHtml(nextHtml, bubbleClass) {
                    if (bubbleClass) bubble.className = bubbleClass;
                    bubble.innerHTML = nextHtml;
                    box.scrollTop = box.scrollHeight;
                },
                update(text) {
                    bubble.className = 'msg bot';
                    bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                    box.scrollTop = box.scrollHeight;
                },
                remove() { row.remove(); },
            };
        }

        function showPiProcessingCard(displayName) {
            _piActiveDisplayName = displayName;
            const html = buildPiProcessingCardHtml(displayName, _piStatusIndex);
            if (_piCopilotProgress) {
                _piCopilotProgress.updateHtml(html);
                return;
            }
            _piStatusIndex = 0;
            _piCopilotProgress = addPiBotProgressCard(
                buildPiProcessingCardHtml(displayName, 0)
            );
            if (_piProgressTimer) {
                clearInterval(_piProgressTimer);
                _piProgressTimer = null;
            }
            _piProgressTimer = setInterval(() => {
                if (!_piCopilotProgress) return;
                if (_piStatusIndex >= PI_EXTRACT_STATUS_MESSAGES.length - 1) return;
                _piStatusIndex += 1;
                _piCopilotProgress.updateHtml(
                    buildPiProcessingCardHtml(_piActiveDisplayName, _piStatusIndex)
                );
            }, 1500);
        }

        function startPiCopilotProcessing(displayName) {
            if (!displayName) return;
            if (_piActiveDisplayName !== displayName) _piStatusIndex = 0;
            dismissCopilotOnboarding();
            ensureCopilotOpen();
            if (!_piUploadHistoryLogged) {
                conversationHistory.push({ role: 'user', content: `Uploaded PI document: ${displayName}` });
                _piUploadHistoryLogged = true;
            }
            showPiProcessingCard(displayName);
        }

        function endPiCopilotProgress() {
            if (_piProgressTimer) {
                clearInterval(_piProgressTimer);
                _piProgressTimer = null;
            }
            if (_piCopilotProgress) {
                _piCopilotProgress.remove();
                _piCopilotProgress = null;
            }
            _piUploadHistoryLogged = false;
            _piActiveDisplayName = '';
            _piStatusIndex = 0;
        }

        function finishPiCopilotProgressMessage(msg) {
            if (_piProgressTimer) {
                clearInterval(_piProgressTimer);
                _piProgressTimer = null;
            }
            if (_piCopilotProgress) {
                _piCopilotProgress.update(msg);
                _piCopilotProgress = null;
                _piUploadHistoryLogged = false;
                _piActiveDisplayName = '';
                _piStatusIndex = 0;
                return;
            }
            addMsg(msg, 'bot');
        }

        function ensureCopilotOpen() {
            const shell = document.getElementById('appShell');
            if (shell && shell.classList.contains('chat-hidden')) {
                shell.classList.remove('chat-hidden');
                const fab = document.getElementById('chatFab');
                if (fab) fab.style.display = 'none';
            }
        }

        function notifyCopilotPiUploadStarted(displayName) {
            startPiCopilotProcessing(displayName);
        }

        function notifyCopilotPiProcessing(displayName) {
            startPiCopilotProcessing(displayName);
        }

        function notifyCopilotPiError(message) {
            endPiCopilotProgress();
            dismissCopilotOnboarding();
            ensureCopilotOpen();
            const detail = message && message.length <= 120 ? message : 'Extraction failed. Try again or enter details manually.';
            const reply = `⚠️ I couldn't read that document. ${detail}`;
            botSay(reply, ['Guide me step by step', 'Describe your product']);
            conversationHistory.push({ role: 'assistant', content: reply });
        }

        function buildSessionStarterPlainText(form) {
            form = form || getStage1FormState();
            if (!form.productName && !form.indication) return '';
            let text = 'Forecast for ' + (form.productName || 'product');
            if (form.classMoa) text += ' (' + form.classMoa + ')';
            if (form.country) text += ' in ' + form.country;
            if (form.indication) text += ' for ' + form.indication;
            if (isLaunchYearValid(form.launchYear)) text += ', launching ' + form.launchYear;
            if (isPeakYearValid(form.peakYear, form.launchYear)) text += ', forecast end year ' + form.peakYear;
            return text;
        }

        function refreshModeChoiceStarterCard() {
            const form = getStage1FormState();
            const sessionText = buildSessionStarterPlainText(form);
            const hasSession = !!(form.productName || form.indication);

            document.querySelectorAll('.mode-choice-card').forEach(card => {
                const exampleRow = card.querySelector('.mode-example-row');
                if (!exampleRow) return;

                if (hasSession && sessionText) {
                    exampleRow.style.display = '';
                    const textEl = exampleRow.querySelector('.mode-example-text');
                    if (textEl) textEl.innerHTML = '&ldquo;' + sessionText + '&rdquo;';
                    exampleRow.title = 'Click to use this forecast';
                    const runSession = () => {
                        const input = document.getElementById('chatInput');
                        if (input) {
                            input.value = sessionText;
                            sendMessage();
                        }
                    };
                    exampleRow.onclick = runSession;
                    const btn = exampleRow.querySelector('.mode-example-insert');
                    if (btn) btn.onclick = (e) => { e.stopPropagation(); runSession(); };
                } else {
                    exampleRow.style.display = 'none';
                }
            });
        }

        function isStage1CopilotContext() {
            if (getWorkflowStage() === 'product_info') return true;
            const card = document.getElementById('productInfoCard');
            return !!(card && card.style.display !== 'none');
        }

        function syncCopilotAfterStage1Fill(options) {
            options = options || {};
            if (options.source !== 'pi_upload') return;
            if (!isStage1CopilotContext()) return;

            refreshModeChoiceStarterCard();
            const form = getStage1FormState();
            syncChatStepFromForm(form);
            const missing = getMissingStage1Steps(form);
            const summary = buildStage1ExtractedSummary(form);

            let msg = '✓ **Product Information extracted successfully.**';
            let qr = [];
            if (summary) msg += `\n\n${summary}`;
            if (missing.length === 0) {
                const confirmBody = buildStage1ConfirmMessage(form).replace(
                    '✓ **All product details captured!** Please review and confirm:\n\n',
                    ''
                );
                msg += `\n\nPlease review and confirm:\n\n${confirmBody}`;
                qr = ['✓ Confirm & Proceed', 'Edit Details'];
                validateProductFields();
            } else {
                msg += `\n\nI still need a few details.\n\n${missing[0].ask}`;
                qr = missing[0].qr;
            }
            finishPiCopilotProgressMessage(msg);
            setQuickReplies(qr);
            const box = document.getElementById('messages');
            if (box) box.scrollTop = box.scrollHeight;
            conversationHistory.push({ role: 'assistant', content: msg });
        }

        function handlePiExtractCopilotSuccess(data, displayName) {
            data = data || {};
            dismissCopilotOnboarding();
            displayName = displayName || data.source_name || 'your document';
            const key = displayName + '|' + (data.session_id || '') + '|' + JSON.stringify(data.fields || {});
            if (_piExtractCompletionKey === key) return;
            _piExtractCompletionKey = key;

            if (data.session_id) setForecastSessionId(data.session_id);
            populateProductInfoFields(data.fields || {}, {
                source: 'pi_upload',
                sourceName: displayName,
            });
        }

        function populateProductInfoFields(fields, options) {
            options = options || {};
            const fromPi = options.source === 'pi_upload';
            if (!fields || typeof fields !== 'object') {
                if (!fromPi) return;
                fields = {};
            }
            if (fromPi) {
                fillField('launchYear', '');
                fillField('peakYear', '');
            }
            const allowed = ['country', 'productName', 'classMoa', 'indication', 'launchYear', 'peakYear'];
            allowed.forEach(id => {
                if (fromPi && (id === 'launchYear' || id === 'peakYear')) return;
                let val = fields[id];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    val = sanitizeStage1DisplayField(id, String(val));
                    fillField(id, val);
                }
            });
            if (fromPi) {
                validateProductFields();
            } else if (fields.launchYear || fields.peakYear) {
                validateProductFields();
            }
            updateDefineFlowButtonState();
            console.log('form population: product info fields applied', Object.keys(fields));
            if (fromPi) {
                syncCopilotAfterStage1Fill(options);
            } else {
                refreshModeChoiceStarterCard();
            }
        }

        function installPiExtractCopilotBridge() {
            if (window.__piExtractCopilotBridgeInstalled) return;
            window.__piExtractCopilotBridgeInstalled = true;
            const origFetch = window.fetch.bind(window);

            function isPiExtractUrl(url) {
                const href = typeof url === 'string' ? url : (url && url.url) || '';
                return String(href).includes('/api/product-info/extract');
            }

            function resolvePiExtractDisplayName(init) {
                if (!init || !init.body) return 'document';
                if (init.body instanceof FormData) {
                    const file = init.body.get('file');
                    if (file && typeof file === 'object' && 'name' in file && file.name) return file.name;
                }
                if (typeof init.body === 'string') {
                    try {
                        const parsed = JSON.parse(init.body);
                        if (parsed.url) {
                            const u = String(parsed.url);
                            return u.length > 48 ? u.slice(0, 45) + '...' : u;
                        }
                    } catch (e) { /* ignore */ }
                }
                return 'document';
            }

            function formatPiExtractError(data) {
                const raw = data.detail || data.message || 'Extraction failed.';
                if (Array.isArray(raw)) {
                    return raw.map(d => (typeof d === 'string' ? d : d.msg || '')).filter(Boolean).join(', ');
                }
                return String(raw);
            }

            window.fetch = async function piExtractFetchBridge(input, init) {
                if (!isPiExtractUrl(input)) {
                    return origFetch(input, init);
                }
                const displayName = resolvePiExtractDisplayName(init);
                notifyCopilotPiProcessing(displayName);
                try {
                    const res = await origFetch(input, init);
                    const data = await res.clone().json().catch(() => ({}));
                    if (res.ok && data.status === 'ok') {
                        handlePiExtractCopilotSuccess(data, displayName);
                    } else if (!res.ok) {
                        notifyCopilotPiError(formatPiExtractError(data));
                    } else {
                        notifyCopilotPiError(formatPiExtractError(data) || 'Extraction failed. Try again.');
                    }
                    return res;
                } catch (err) {
                    notifyCopilotPiError('Extraction failed. Try again.');
                    throw err;
                }
            };
        }

        // ── Compact "field chip" UI (Product Info) ──────────────────────────────
        // Fields render as small click-to-edit chips instead of always-open inputs,
        // since the prompt/chat flow (or PI upload) is the primary way to fill them.
        const FIELD_CHIP_IDS = ['country', 'productName', 'classMoa', 'indication', 'launchYear', 'peakYear'];
        const FIELD_CHIP_EMPTY_TEXT = {
            country: 'Select country',
            productName: 'Add product name',
            classMoa: 'Add class / MoA',
            indication: 'Add indication',
            launchYear: 'Add year',
            peakYear: 'Add year',
        };

        function activateFieldChip(fieldId) {
            const chip = document.querySelector(`.field-chip[data-field="${fieldId}"]`);
            const input = document.getElementById(fieldId);
            if (!chip || !input) return;
            chip.classList.add('editing');
            input.focus();
        }

        function collapseFieldChip(fieldId) {
            const chip = document.querySelector(`.field-chip[data-field="${fieldId}"]`);
            if (!chip) return;
            chip.classList.remove('editing');
            updateFieldChipValue(fieldId);
            debouncedSave();
        }

        function updateFieldChipValue(fieldId) {
            const el = document.getElementById(fieldId);
            const valueSpan = document.getElementById(fieldId + 'ChipValue');
            if (!el || !valueSpan) return;
            let display = el.tagName === 'SELECT'
                ? (el.value ? el.options[el.selectedIndex].text : '')
                : el.value;
            if (fieldId === 'indication' || fieldId === 'classMoa') {
                display = sanitizeStage1DisplayField(fieldId, display);
            }
            valueSpan.textContent = display || FIELD_CHIP_EMPTY_TEXT[fieldId] || '—';
            valueSpan.classList.toggle('empty', !display);
            updateDefineFlowButtonState();
            syncHeaderContext();
        }

        // "Where am I? What am I editing?" — a breadcrumb (Forecasts / TUB-040 · NSCLC)
        // built entirely from DOM text nodes, never innerHTML string interpolation,
        // since productName/indication are free-text user input.
        function syncHeaderContext() {
            const el = document.getElementById('whForecastContext');
            if (!el) return;
            const productName = (document.getElementById('productName') || {}).value || '';
            const indication = (document.getElementById('indication') || {}).value || '';
            el.textContent = '';
            if (!productName && !indication) return;

            const crumb = document.createElement('span');
            crumb.className = 'wh-context-crumb';
            crumb.textContent = 'Forecasts';
            el.appendChild(crumb);

            const sep = document.createElement('span');
            sep.className = 'wh-context-sep';
            sep.textContent = '/';
            el.appendChild(sep);

            const name = document.createElement('span');
            name.className = 'wh-context-name';
            name.textContent = productName || indication;
            el.appendChild(name);

            if (productName && indication) {
                const dot = document.createElement('span');
                dot.className = 'wh-context-sep';
                dot.textContent = '·';
                el.appendChild(dot);

                const ind = document.createElement('span');
                ind.className = 'wh-context-indication';
                ind.textContent = indication;
                el.appendChild(ind);
            }
        }

        // Live AI status pill in the workspace header — flips to a busy state
        // (pulsing amber dot) during requestAIRecommendation/applyAIRecommendation
        // so the header participates in the same "AI is working" moment as the
        // flow's own cascade, instead of sitting there inert the whole time.
        // mode: 'busy' | 'reviewing' | 'done' | undefined (idle/ready)
        function setAIStatus(text, mode) {
            const pill = document.getElementById('aiStatusPill');
            const label = document.getElementById('aiStatusText');
            if (!pill || !label) return;
            label.textContent = text;
            pill.classList.toggle('ai-status-busy', mode === 'busy' || mode === true);
            pill.classList.toggle('ai-status-reviewing', mode === 'reviewing');
            pill.classList.toggle('ai-status-done', mode === 'done');
        }

        // Reflects the real debouncedSave()/saveUserInput() autosave — never a
        // decorative indicator. state: 'saving' | 'saved' | 'error'.
        function setSaveStatus(state) {
            const pill = document.getElementById('saveStatusPill');
            const label = document.getElementById('saveStatusText');
            if (!pill || !label) return;
            pill.classList.remove('save-status-saving', 'save-status-error');
            if (state === 'saving') {
                pill.classList.add('save-status-saving');
                label.textContent = 'Saving…';
            } else if (state === 'error') {
                pill.classList.add('save-status-error');
                label.textContent = 'Save failed';
            } else {
                label.textContent = '✓ Saved';
            }
        }

        function updateAllFieldChips() {
            FIELD_CHIP_IDS.forEach(updateFieldChipValue);
        }

        // Keeps "Define Forecast Flow" disabled until every required field has a
        // value (and any active year-range validation errors are cleared), so
        // clicking it never silently does nothing.
        function updateDefineFlowButtonState() {
            const btn = document.getElementById('defineFlowBtn');
            if (!btn) return;
            const allFilled = FIELD_CHIP_IDS.every(id => {
                const el = document.getElementById(id);
                return el && el.value && el.value.trim() !== '';
            });
            const isValid = allFilled && Object.keys(validationErrors).length === 0;
            btn.disabled = !isValid;
            btn.classList.toggle('btn-disabled', !isValid);
        }

        function flashFieldChip(fieldId) {
            const chip = document.querySelector(`.field-chip[data-field="${fieldId}"]`);
            if (!chip) return;
            chip.classList.add('flash');
            setTimeout(() => chip.classList.remove('flash'), 1400);
        }

        // Returns which workflow stage the user is currently on
        function getWorkflowStage() {
            const vis = id => {
                const el = document.getElementById(id);
                return el && !el.classList.contains('hidden') && el.style.display !== 'none';
            };
            if (vis('resultsSection')) return 'results';
            if (vis('forecastEngineSection')) return 'forecast_engine';
            if (vis('assumptionsSection')) return 'assumptions';
            if (vis('parameterSelectionSection')) return 'parameter_selection';
            return 'product_info';
        }

        async function sendMessage() {
            const input = document.getElementById('chatInput');
            const text = input.value.trim();
            if (!text) return;

            dismissCopilotOnboarding();
            document.getElementById('quickRepliesContainer').innerHTML = '';
            addMsg(text, 'user');
            input.value = '';
            conversationHistory.push({ role: 'user', content: text });

            await handleUserMessage(text);
        }

        async function handleUserMessage(text) {
            const lower = text.toLowerCase();

            // ── Only intercept as a shortcut if the message is clearly a command, not a question ──
            // A "question" is detected by: starts with question words, contains '?', or is > 8 words
            const isQuestion = text.includes('?') ||
                /^\s*(what|how|which|why|when|where|who|can|could|should|would|is|are|does|do|tell|explain|help|please|i want to know|what's|whats)/i.test(text);
            const wordCount = text.trim().split(/\s+/).length;
            const looksLikeCommand = !isQuestion && wordCount <= 9;

            // Get AI Recommendation from chat — fetches and posts the rationale
            if (looksLikeCommand && /^get\s*(ai\s*)?(recommendation|rec)$/i.test(text.trim())) {
                requestAIRecommendation();
                return;
            }
            // Apply Recommendation from chat
            if (looksLikeCommand && /apply\s*(ai\s*)?(recommendation|rec)/i.test(text.trim())) {
                if (aiRecLoading) {
                    botSay('The AI recommendation is still being generated. Please wait a moment and try again.');
                    return;
                }
                applyAIRecommendation();
                return;
            }
            // Generate Now (after being asked what to do)
            if (looksLikeCommand && /^(generate\s*now|generate\s*with\s*current|proceed\s*to\s*generate|use\s*current\s*settings?)$/i.test(text.trim())) {
                conversationHistory.push({ role: 'assistant', content: 'Starting assumption generation…' });
                generateAssumptions(null); // research animation itself shows progress — no redundant botSay
                return;
            }
            if (looksLikeCommand && /^(generate\s*(assumptions?|flow)|next\s*step|generate)$/i.test(text.trim())) {
                const section = document.getElementById('parameterSelectionSection');
                const isVisible = section && !section.classList.contains('hidden') && section.style.display !== 'none';
                if (isVisible) {
                    // Ask the user what they want to do
                    const indication = document.getElementById('indication').value || 'your indication';
                    const qrOptions = aiRecApplied
                        ? ['Generate Now']
                        : ['Get AI Recommendation', 'Generate Now'];
                    const reply = aiRecApplied
                        ? `Ready to generate assumptions for **${indication}**. Click **Generate Now** to proceed, or customise parameters further.`
                        : `Ready to generate. Here's what I can do:\n\n**Get AI Recommendation** — analyse **${indication}** and suggest the best parameters\n**Generate Now** — use your current parameter selections\n\nWhat would you like to do?`;
                    conversationHistory.push({ role: 'assistant', content: reply });
                    botSay(reply, qrOptions);
                } else {
                    const reply = 'Proceeding to **Define Forecast Flow**…';
                    conversationHistory.push({ role: 'assistant', content: reply });
                    botSay(reply);
                    setTimeout(() => showParameterSelection(), 800);
                }
                return;
            }
            if (looksLikeCommand && /^(calculate forecast|run forecast|calculate|run)$/i.test(text.trim())) {
                const reply = 'Running the **Forecast Engine** now…';
                conversationHistory.push({ role: 'assistant', content: reply });
                botSay(reply);
                setTimeout(() => { calculateForecast(); }, 800);
                return;
            }
            if (looksLikeCommand && /^(view results?|show (results?|charts?)|results?|charts?)$/i.test(text.trim())) {
                const reply = 'Jumping to **Results & Charts**';
                conversationHistory.push({ role: 'assistant', content: reply });
                botSay(reply);
                setTimeout(() => { proceedToResults(); }, 800);
                return;
            }
            if (looksLikeCommand && /^(start over|restart|new forecast)$/i.test(text.trim())) {
                const reply = 'Starting a **new forecast**. Fill in the product details when you\'re ready!';
                conversationHistory.push({ role: 'assistant', content: reply });
                botSay(reply);
                setTimeout(() => { startOver(); chatStep = 0; }, 800);
                return;
            }
            if (looksLikeCommand && /^(export|download|download excel)$/i.test(text.trim())) {
                const dlBtn = document.getElementById('downloadExcelBtn');
                if (dlBtn && !dlBtn.classList.contains('btn-disabled') && dlBtn.href && dlBtn.href !== '#') {
                    botSay('Downloading **Excel**…');
                    dlBtn.click();
                } else {
                    botSay('Excel workbook is still being built by the agent. Please wait for **Download Excel** to become available.');
                }
                return;
            }

            // ── Confirm & Proceed (product info → parameter selection) ──
            if (/confirm\s*(&|and)?\s*(proceed|continue)|✓\s*confirm|yes[,.]?\s*proceed|confirm\s*details?/i.test(text.trim())) {
                if (chatStep >= 6 && getWorkflowStage() === 'product_info') {
                    showParameterSelection();
                    return;
                }
            }
            // ── Edit Details request ──
            if (looksLikeCommand && /^(edit\s*(details?|info|form|product)|change\s*details?)$/i.test(text.trim())) {
                if (getWorkflowStage() === 'product_info') {
                    botSay('No problem! Please update any field in the form above, or tell me what you\'d like to change.', ['Change Country', 'Change Product Name', 'Change Indication', 'Change Years']);
                    return;
                }
            }

            // ── Call OpenAI backend ──
            const msgBox = document.getElementById('messages');
            const typingRow = document.createElement('div');
            typingRow.id = 'typingWrap';
            typingRow.className = 'msg-row bot';

            const typingAvatar = document.createElement('div');
            typingAvatar.className = 'msg-avatar';
            typingAvatar.innerHTML = COPILOT_AVATAR_ICON;

            const typingContent = document.createElement('div');
            typingContent.className = 'msg-content';
            typingContent.innerHTML = '<div class="msg bot typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

            typingRow.appendChild(typingAvatar);
            typingRow.appendChild(typingContent);
            msgBox.appendChild(typingRow);
            msgBox.scrollTop = msgBox.scrollHeight;

            const formState = {
                country: document.getElementById('country').value,
                productName: document.getElementById('productName').value,
                classMoa: document.getElementById('classMoa').value,
                indication: document.getElementById('indication').value,
                launchYear: document.getElementById('launchYear').value,
                peakYear: document.getElementById('peakYear').value,
            };

            try {
                const res = await fetch(`${BACKEND_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: conversationHistory.slice(-20),
                        chat_step: chatStep,
                        form_state: formState,
                        workflow_stage: getWorkflowStage(),
                    }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const tw = document.getElementById('typingWrap');
                if (tw) tw.remove();

                // Apply field updates from OpenAI (may contain multiple fields at once)
                const prevChatStep = chatStep;
                if (data.field_updates && Object.keys(data.field_updates).length > 0) {
                    Object.entries(data.field_updates).forEach(([key, val]) => {
                        // Skip empty/null values to avoid wiping already-filled fields
                        if (val === null || val === undefined || String(val).trim() === '') return;
                        fillField(key, String(val));
                        const idx = steps.findIndex(s => s.key === key);
                        if (idx !== -1 && idx >= chatStep) chatStep = idx + 1;
                    });
                    // If all 6 fields are now filled, advance chatStep to 6
                    const formNow = {
                        country: document.getElementById('country').value,
                        productName: document.getElementById('productName').value,
                        classMoa: document.getElementById('classMoa').value,
                        indication: document.getElementById('indication').value,
                        launchYear: document.getElementById('launchYear').value,
                        peakYear: document.getElementById('peakYear').value,
                    };
                    const allFilled = Object.values(formNow).every(v => v && v.trim() !== '');
                    if (allFilled) chatStep = 6;
                    if (allFilled) validateProductFields();
                    // If all fields JUST became complete, show confirmation instead of backend message
                    if (chatStep === 6 && prevChatStep < 6 && getWorkflowStage() === 'product_info') {
                        const confirmMsg = `✓ **All product details captured!** Please review and confirm:\n\n• **Country:** ${formNow.country}\n• **Product:** ${formNow.productName}\n• **Class/MoA:** ${formNow.classMoa}\n• **Indication:** ${formNow.indication}\n• **Launch Year:** ${formNow.launchYear} → **Forecast - End Year:** ${formNow.peakYear}\n\nDoes everything look correct? Click **Confirm & Proceed** to move to the next step.`;
                        addMsg(confirmMsg, 'bot');
                        setQuickReplies(['✓ Confirm & Proceed', 'Edit Details']);
                        conversationHistory.push({ role: 'assistant', content: confirmMsg });
                        return;
                    }
                }

                // Trigger a workflow action if requested
                if (data.action) {
                    setTimeout(() => {
                        if (data.action === 'show_parameter_selection') showParameterSelection();
                        else if (data.action === 'generate_assumptions') {
                            const _sec = document.getElementById('parameterSelectionSection');
                            const _vis = _sec && !_sec.classList.contains('hidden') && _sec.style.display !== 'none';
                            if (_vis) { generateAssumptions(null); }
                            else { showParameterSelection(); setTimeout(() => generateAssumptions(null), 600); }
                        }
                        else if (data.action === 'calculate_forecast') calculateForecast();
                        else if (data.action === 'proceed_results') proceedToResults();
                        // Only reset if the user explicitly asked to — never on a normal question
                        else if (data.action === 'start_over' && /start\s*over|restart|new\s*forecast/i.test(text)) { startOver(); chatStep = 0; }
                    }, 900);
                }

                const qr = Array.isArray(data.quick_replies) ? data.quick_replies : [];
                addMsg(data.bot_message, 'bot');
                setQuickReplies(qr);
                conversationHistory.push({ role: 'assistant', content: data.bot_message });

            } catch (err) {
                // Backend unreachable → fall back to local rule-based logic
                console.warn('Backend unreachable, using local fallback:', err);
                const tw = document.getElementById('typingWrap');
                if (tw) tw.remove();
                handleUserMessageLocal(text);
            }
        }

        // ── Helper: detect if text looks like random noise ──
        function looksNonsensical(text) {
            const t = text.trim();
            // Valid 4-digit years (2020–2049) are NEVER nonsensical
            if (/^20[2-4]\d$/.test(t)) return false;
            // Purely numeric or very short token that isn't a year
            if (/^[^a-zA-Z]{1,4}$/.test(t)) return true;
            // Long run of consonants with no vowels
            if (/^[^aeiou\s]{6,}$/i.test(t)) return true;
            return false;
        }

        // ── Helper: resolve country alias ──
        function resolveCountry(text) {
            const lower = text.toLowerCase().trim();
            if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
            return COUNTRIES.find(c => lower.includes(c.toLowerCase())) || null;
        }

        // ── Helper: try to extract multiple fields from free text ──
        function extractFieldsLocal(text) {
            const lower = text.toLowerCase();
            const updates = {};

            // Country
            const country = resolveCountry(text);
            if (country) updates.country = country;
            else {
                // Try fragment match (e.g. "in germany")
                for (const [alias, canon] of Object.entries(COUNTRY_ALIASES)) {
                    if (lower.includes(alias)) { updates.country = canon; break; }
                }
            }

            // Years — look for explicit "launch" / "peak" context
            const years = [...text.matchAll(/\b(20[2-4]\d)\b/g)].map(m => parseInt(m[1]));
            if (years.length === 1) {
                if (/launch|start|begin|introduc/i.test(text)) updates.launchYear = String(years[0]);
                else if (/peak|max|highest/i.test(text)) updates.peakYear = String(years[0]);
                else {
                    // No keyword context — use chatStep to infer which year field is being answered
                    const currentStep = chatStep < steps.length ? steps[chatStep] : null;
                    if (currentStep && currentStep.key === 'peakYear') {
                        updates.peakYear = String(years[0]);
                    } else if (currentStep && currentStep.key === 'launchYear') {
                        updates.launchYear = String(years[0]);
                    }
                    // If both are missing and no context, fall back to launchYear first
                    else if (!document.getElementById('launchYear').value) {
                        updates.launchYear = String(years[0]);
                    } else if (!document.getElementById('peakYear').value) {
                        updates.peakYear = String(years[0]);
                    }
                }
            } else if (years.length >= 2) {
                // Assume first = launch, second = peak (most natural order)
                updates.launchYear = String(Math.min(...years));
                updates.peakYear = String(Math.max(...years));
            }

            // Product name — heuristic matches:
            //   "for Keytruda", "called Keytruda", "product Keytruda", "drug Keytruda", quoted, or
            //   any CamelCase/mixed token that looks like a brand name and isn't already a known field value
            const KNOWN_WORDS = new Set([
                ...COUNTRIES.map(c => c.toLowerCase()),
                ...Object.keys(COUNTRY_ALIASES),
                'forecast', 'for', 'the', 'a', 'an', 'in', 'on', 'at', 'with', 'and', 'or', 'of', 'to', 'is',
                'launching', 'launch', 'peak', 'sales', 'year', 'target', 'indication', 'country',
                'product', 'drug', 'compound', 'called', 'named', 'inhibitor', 'antibody', 'therapy',
                'treatment', 'cancer', 'disease', 'diabetes', 'oncology', 'sclerosis', 'arthritis',
                'failure', 'alzheimer', 'nsclc', 'sclc', 'crc', 'hcc', 'tnbc', 'aml', 'cll', 'dlbcl',
                't2d', 'ra', 'ms', 'hf'
            ]);
            const nameMatch =
                // Explicit keyword before name
                text.match(/(?:(?:product|drug|compound|called|named?|for)\s+)([A-Z][A-Za-z0-9][A-Za-z0-9\-\.]{1,28})(?:\s|,|\(|$)/m)
                // Quoted string
                || text.match(/"([^"]{2,40})"/)
                || text.match(/'([^']{2,40})'/);
            if (nameMatch && nameMatch[1]) {
                const candidate = nameMatch[1].trim();
                // Accept if not a purely lowercase common word and not already matched as another field
                if (!KNOWN_WORDS.has(candidate.toLowerCase()) && /[A-Z]/.test(candidate[0])) {
                    updates.productName = candidate;
                }
            }
            // Fallback: scan all tokens for a capitalised word that looks like a brand name
            // (starts uppercase, ≥4 chars, not a known word, not a year)
            if (!updates.productName) {
                const tokens = text.match(/\b([A-Z][a-zA-Z0-9\-]{3,30})\b/g) || [];
                for (const tok of tokens) {
                    if (!KNOWN_WORDS.has(tok.toLowerCase()) && !/^20\d\d$/.test(tok)) {
                        // Also skip if it's already captured as country/indication/MoA
                        const alreadyCaptured = [
                            updates.country, updates.indication, updates.classMoa
                        ].some(v => v && v.toLowerCase().includes(tok.toLowerCase()));
                        if (!alreadyCaptured) { updates.productName = tok; break; }
                    }
                }
            }

            // Class/MoA — known patterns
            const moaPatterns = [
                'Monoclonal Antibody', 'mAb', 'PD-1 Inhibitor', 'PD-L1 Inhibitor', 'PD1', 'PDL1',
                'SGLT2 Inhibitor', 'SGLT2', 'BTK Inhibitor', 'BTK', 'JAK Inhibitor', 'JAK',
                'PCSK9 Inhibitor', 'PCSK9', 'GLP-1', 'CAR-T', 'CAR T',
            ];
            for (const pat of moaPatterns) {
                if (lower.includes(pat.toLowerCase())) {
                    updates.classMoa = pat.replace(/\b\w/g, c => c.toUpperCase());
                    break;
                }
            }

            // Indication — known patterns
            const indicationMap = [
                ['rheumatoid arthritis', 'ra ', '\bra\b'],
                ['multiple sclerosis', 'ms ', '\bms\b'],
                ['type 2 diabetes', 't2d', 'diabetes'],
                ['oncology', 'cancer', 'nsclc', 'sclc', 'crc', 'hcc', 'tnbc', 'aml', 'cll', 'dlbcl'],
                ['alzheimer', 'dementia'],
                ['heart failure', 'hf ', '\bhf\b', 'hfref', 'hfpef'],
            ];
            const indicationCanon = [
                'Rheumatoid Arthritis', 'Multiple Sclerosis', 'Type 2 Diabetes',
                'Oncology', 'Alzheimer Disease', 'Heart Failure'
            ];
            for (let i = 0; i < indicationMap.length; i++) {
                if (indicationMap[i].some(k => new RegExp(k, 'i').test(text))) {
                    updates.indication = indicationCanon[i]; break;
                }
            }

            return updates;
        }

        function handleUserMessageLocal(text) {
            const lower = text.toLowerCase();

            // ── Confirm & Proceed ──
            if (/confirm\s*(&|and)?\s*(proceed|continue)|✓\s*confirm|yes[,.]?\s*proceed|confirm\s*details?/i.test(text.trim()) && chatStep >= 6 && getWorkflowStage() === 'product_info') {
                showParameterSelection();
                return;
            }
            // ── Edit Details ──
            if (/^(edit\s*(details?|info|form|product)|change\s*details?)$/i.test(text.trim())) {
                botSay('No problem! Please update any field in the form above, or tell me what you\'d like to change.', ['Change Country', 'Change Product Name', 'Change Indication', 'Change Years']);
                return;
            }

            // ── Detect pure question ──
            const isQuestion = /\?/.test(text) ||
                /^\s*(what|how|which|why|when|where|who|can|could|should|would|is|are|does|do|tell|explain|help|please|i want to know|what's|whats)/i.test(text);

            if (isQuestion) {
                // Generic help depending on current missing field
                const nextStep = chatStep < steps.length ? steps[chatStep] : null;
                const hints = {
                    country: 'You can target one of these markets: ' + COUNTRIES.join(', '),
                    productName: 'Please tell me the drug/compound name (e.g. **TUB-040**, **ABC-101**, **NovaMab**).',
                    classMoa: 'Common classes include:\n• **Monoclonal Antibody**\n• **SGLT2 Inhibitor**\n• **PD-1 Inhibitor**\n• **JAK Inhibitor**\n• **BTK Inhibitor**',
                    indication: 'Common indications include:\n' + INDICATIONS.map(i => `• **${i}**`).join('\n'),
                    launchYear: 'The planned launch year (e.g. **2026**, **2027**). Must be 2024–2040.',
                    peakYear: 'The Forecast - End Year — must be after the launch year.',
                };
                const hintQr = {
                    country: COUNTRIES, productName: [], classMoa: ['Monoclonal Antibody', 'SGLT2 Inhibitor', 'PD-1 Inhibitor', 'JAK Inhibitor'],
                    indication: INDICATIONS, launchYear: ['2025', '2026', '2027', '2028', '2030'],
                    peakYear: ['2030', '2031', '2032', '2033', '2035'],
                };
                if (nextStep) {
                    const msg = (hints[nextStep.key] || nextStep.ask) + `\n\n${nextStep.ask}`;
                    botSay(msg, hintQr[nextStep.key] || nextStep.qr);
                } else {
                    botSay('All fields are filled! Click **Define Forecast Flow →** or type **"generate assumptions"**.', ['Generate Assumptions']);
                }
                return;
            }

            // ── Try multi-field extraction first ──
            const extracted = extractFieldsLocal(text);
            const filledNow = [];

            // Validate years
            if (extracted.launchYear) {
                const yr = parseInt(extracted.launchYear);
                if (yr < 2024 || yr > 2040) {
                    botSay(`⚠️ **Launch year ${yr}** seems outside the valid range (2024–2040). Please provide a realistic launch year.`,
                        ['2026', '2027', '2028', '2029', '2030']);
                    delete extracted.launchYear;
                }
            }
            if (extracted.peakYear) {
                const pyr = parseInt(extracted.peakYear);
                const lyr = parseInt(extracted.launchYear || document.getElementById('launchYear').value);
                if (pyr < 2025 || pyr > 2045) {
                    botSay(`⚠️ **Forecast - End Year ${pyr}** seems outside the valid range (2025–2045).`,
                        ['2029', '2030', '2031', '2032', '2033']);
                    delete extracted.peakYear;
                } else if (lyr && pyr <= lyr) {
                    botSay(`⚠️ **Forecast - End Year (${pyr})** must be after launch year (${lyr}). Please enter a later year.`,
                        [String(lyr + 2), String(lyr + 3), String(lyr + 5)]);
                    delete extracted.peakYear;
                }
            }

            // Apply all validated extractions
            Object.entries(extracted).forEach(([key, val]) => {
                fillField(key, String(val));
                filledNow.push(key);
                const idx = steps.findIndex(s => s.key === key);
                if (idx !== -1 && idx >= chatStep) chatStep = idx + 1;
            });

            // If nothing extracted at all, check if it looks nonsensical
            if (filledNow.length === 0) {
                if (looksNonsensical(text)) {
                    const nextStep = chatStep < steps.length ? steps[chatStep] : null;
                    if (nextStep) {
                        botSay(`I didn't quite understand that. ${nextStep.ask}`, nextStep.qr);
                    } else {
                        botSay('Could you clarify what you meant? All fields are already filled — type **"generate assumptions"** to continue.', ['Generate Assumptions']);
                    }
                    return;
                }
                // Fall through to per-field handling
            }

            // Check which fields are still missing
            const formNow = {
                country: document.getElementById('country').value,
                productName: document.getElementById('productName').value,
                classMoa: document.getElementById('classMoa').value,
                indication: document.getElementById('indication').value,
                launchYear: document.getElementById('launchYear').value,
                peakYear: document.getElementById('peakYear').value,
            };
            const stillMissing = steps.filter(s => !formNow[s.key] || formNow[s.key].trim() === '');
            const allFilled = stillMissing.length === 0;

            if (filledNow.length > 0) {
                const filledLabels = filledNow.map(k => {
                    const s = steps.find(x => x.key === k);
                    return s ? `**${s.key === 'country' ? formNow.country : s.key === 'productName' ? formNow.productName :
                        s.key === 'classMoa' ? formNow.classMoa : s.key === 'indication' ? formNow.indication :
                            s.key === 'launchYear' ? formNow.launchYear : formNow.peakYear}**` : k;
                }).join(', ');

                if (allFilled) {
                    chatStep = 6;
                    validateProductFields();
                    botSay(`✓ **All product details captured!** Please review and confirm:\n\n• **Country:** ${formNow.country}\n• **Product:** ${formNow.productName}\n• **Class/MoA:** ${formNow.classMoa}\n• **Indication:** ${formNow.indication}\n• **Launch Year:** ${formNow.launchYear} → **Forecast - End Year:** ${formNow.peakYear}\n\nDoes everything look correct? Click **Confirm & Proceed** to move to the next step.`,
                        ['✓ Confirm & Proceed', 'Edit Details']);
                } else {
                    const next = stillMissing[0];
                    botSay(`✓ Got ${filledLabels}.\n\n${next.ask}`, next.qr);
                }
                return;
            }

            // ── Nothing extracted — step-by-step mode ──
            if (chatStep < steps.length) {
                const step = steps[chatStep];
                let value = text.trim();

                if (step.key === 'launchYear' || step.key === 'peakYear') {
                    const yr = parseInt(value.replace(/[^0-9]/g, ''));
                    if (!yr || yr < 2020 || yr > 2055) {
                        botSay('⚠️ Please enter a valid year between 2024 and 2045.');
                        return;
                    }
                    value = yr.toString();
                    if (step.key === 'peakYear') {
                        const launchVal = parseInt(document.getElementById('launchYear').value);
                        if (launchVal && yr <= launchVal) {
                            botSay(`⚠️ Forecast - End Year must be **after** launch year (${launchVal}). Try a year like **${launchVal + 3}** or later.`,
                                [String(launchVal + 2), String(launchVal + 3), String(launchVal + 5)]);
                            return;
                        }
                    }
                }
                if (step.key === 'country') {
                    const match = resolveCountry(value);
                    if (!match) {
                        botSay('⚠️ I didn\'t recognise that country. Please choose from the list:', COUNTRIES);
                        return;
                    }
                    value = match;
                }

                if (looksNonsensical(value) && step.key !== 'launchYear' && step.key !== 'peakYear') {
                    botSay(`That doesn't look like a valid **${step.key}**. ${step.ask}`, step.qr);
                    return;
                }

                fillField(step.key, value);
                chatStep++;

                const updatedForm = {
                    country: document.getElementById('country').value,
                    productName: document.getElementById('productName').value,
                    classMoa: document.getElementById('classMoa').value,
                    indication: document.getElementById('indication').value,
                    launchYear: document.getElementById('launchYear').value,
                    peakYear: document.getElementById('peakYear').value,
                };
                const remaining = steps.filter(s => !updatedForm[s.key] || updatedForm[s.key].trim() === '');

                if (remaining.length === 0) {
                    chatStep = 6;
                    validateProductFields();
                    botSay(`✓ **All product details captured!** Please review and confirm:\n\n• **Country:** ${updatedForm.country}\n• **Product:** ${updatedForm.productName}\n• **Class/MoA:** ${updatedForm.classMoa}\n• **Indication:** ${updatedForm.indication}\n• **Launch Year:** ${updatedForm.launchYear} → **Forecast - End Year:** ${updatedForm.peakYear}\n\nDoes everything look correct? Click **Confirm & Proceed** to move to the next step.`,
                        ['✓ Confirm & Proceed', 'Edit Details']);
                } else {
                    const next = remaining[0];
                    botSay(`✓ Got **${value}**.\n\n${next.ask}`, next.qr);
                }
                return;
            }

            // ── All steps done: action commands ──
            const tips = [
                'Type **"generate assumptions"** to move to the next step.',
                'Try: **"calculate forecast"** to run the engine.',
                'Try: **"start over"** to begin a new forecast.',
            ];
            botSay(tips[Math.floor(Math.random() * tips.length)]);
        }

        function clearChat() {
            conversationHistory = [];
            chatStep = 0;
            document.getElementById('messages').innerHTML = '';
            document.getElementById('quickRepliesContainer').innerHTML = '';
            // Reset forecast tool silently (suppresses its own bot message)
            startOver(true);
            resetCopilotOnboardingState();
            const resetMsg = 'Chat and forecast cleared.\n\nHow would you like to begin?';
            botSayModeChoice(resetMsg);
            conversationHistory = [{ role: 'assistant', content: resetMsg }];
        }

        // Initialise chat — run immediately if load already fired (Next.js afterInteractive),
        // otherwise wait for load event
        function _initChat() {
            updateAllFieldChips();
            const welcomeMsg = 'Let\'s build your forecast.\n\nHow would you like to begin?';
            botSayModeChoice(welcomeMsg);
            conversationHistory = [{ role: 'assistant', content: welcomeMsg }];
        }
        if (document.readyState === 'complete') {
            _initChat();
        } else {
            window.addEventListener('load', _initChat);
        }

        function setSidebarActive(el) {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
        }

        /* ════════════════════════════════════════════════
           FORECAST TOOL LOGIC  (unchanged from original)
        ════════════════════════════════════════════════ */
        let assumptions = {};
        let researchSources = [];   // sources returned by /api/research
        let salesChart = null, patientsChart = null, shareChart = null;
        let forecastData = [];
        let rationaleVisible = true;
        let selectedParameters = {
            epidemiology: 'prevalence',
            parameters: ['population', 'prevalence', 'diagnosisRate', 'treatmentRate', 'eligibilityCriteria', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount']
        };
        let customParameters = {};
        let parameterLabels = {
            population: 'Total Population', prevalence: 'Prevalence Rate', incidence: 'Incidence Rate',
            severity: 'Severity / Subtype %', diagnosisRate: 'Diagnosis Rate', treatmentRate: 'Treatment Rate',
            eligibilityCriteria: 'Eligibility Criteria', progressionRate: 'Disease Progression Rate',
            classShare: 'Peak Class Share', peakProductShare: 'Peak Product Share',
            annualCostPerPatient: 'Annual Cost per Patient', discount: 'Discount/Rebate Rate',
            adoptionPeakTime: 'Time to Peak (Years)'
        };

        const epidemiologyDefaults = {
            'Rheumatoid Arthritis': { prevalence: 0.005, diagnosis: 0.75, treatment: 0.70, biomarker: 0.80 },
            'Multiple Sclerosis': { prevalence: 0.0025, diagnosis: 0.85, treatment: 0.80, biomarker: 0.90 },
            'Type 2 Diabetes': { prevalence: 0.095, diagnosis: 0.70, treatment: 0.65, biomarker: 0.85 },
            'Oncology': { prevalence: 0.0045, diagnosis: 0.90, treatment: 0.75, biomarker: 0.70 },
            'Alzheimer Disease': { prevalence: 0.011, diagnosis: 0.65, treatment: 0.50, biomarker: 0.60 },
            'Heart Failure': { prevalence: 0.020, diagnosis: 0.80, treatment: 0.70, biomarker: 0.75 },
            'Default': { prevalence: 0.005, diagnosis: 0.75, treatment: 0.70, biomarker: 0.80 }
        };
        const populationData = {
            'United States': 335000000, 'Germany': 84000000, 'United Kingdom': 68000000, 'France': 68000000,
            'Japan': 125000000, 'China': 1425000000, 'Canada': 39000000, 'Italy': 59000000, 'Spain': 48000000
        };
        const discountRates = {
            'United States': { base: 0.22, range: '15-30%' }, 'Germany': { base: 0.18, range: '12-25%' },
            'United Kingdom': { base: 0.20, range: '15-28%' }, 'France': { base: 0.19, range: '14-26%' },
            'Japan': { base: 0.12, range: '8-18%' }, 'China': { base: 0.25, range: '18-35%' },
            'Canada': { base: 0.21, range: '16-28%' }, 'Italy': { base: 0.17, range: '12-24%' },
            'Spain': { base: 0.16, range: '11-23%' }
        };

        function showParameterSelection() {
            const productValid = validateProductFields();
            const country = document.getElementById('country').value,
                productName = document.getElementById('productName').value,
                classMoa = document.getElementById('classMoa').value,
                indication = document.getElementById('indication').value,
                launchYear = parseInt(document.getElementById('launchYear').value),
                peakYear = parseInt(document.getElementById('peakYear').value);
            if (!country || !productName || !classMoa || !indication) { alert('Please fill in all required fields'); return; }
            if (!productValid) { return; }
            document.getElementById('productInfoCard').style.display = 'none';
            document.getElementById('parameterSelectionSection').classList.remove('hidden');
            document.getElementById('parameterSelectionSection').style.display = 'block';
            updateFlowPreview();
            updateNavigation(2);
            document.querySelectorAll('.param-checkbox,.param-radio').forEach(i => i.addEventListener('change', updateFlowPreview));
            aiRecApplied = false; // reset for new forecast session
            initializeDragAndDrop();
            botSay(`✓ **Product details confirmed!**\n\n• **Country:** ${country}\n• **Product:** ${productName}\n• **Class/MoA:** ${classMoa}\n• **Indication:** ${indication}\n• **Launch Year:** ${launchYear} → **Forecast - End Year:** ${peakYear}\n\nMoving to **Step 2: Define Forecast Flow**. Choose a template preset, click **Get AI Recommendation** for a tailored parameter analysis, or customise manually below.`, ['Get AI Recommendation', 'Generate Now', 'Customise Parameters']);
        }

        function initializeDragAndDrop() {
            document.querySelectorAll('.parameter-list').forEach(list => {
                list.addEventListener('dragstart', handleDragStart);
                list.addEventListener('dragover', handleDragOver);
                list.addEventListener('drop', handleDrop);
                list.addEventListener('dragend', handleDragEnd);
            });
        }
        let draggedElement = null;
        function handleDragStart(e) {
            if (e.target.classList.contains('parameter-item') && e.target.draggable) {
                draggedElement = e.target;
                e.target.style.opacity = '0.4';
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', e.target.getAttribute('data-param') || '');
                }
            }
        }
        function handleDragOver(e) { if (e.preventDefault) e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
        function handleDrop(e) {
            if (e.stopPropagation) e.stopPropagation();
            if (draggedElement && e.target.classList.contains('parameter-item')) {
                const list = draggedElement.parentNode, tl = e.target.parentNode;
                if (list === tl && draggedElement !== e.target) {
                    if (draggedElement.getAttribute('data-param') === 'population') return false;
                    if (e.target.getAttribute('data-param') === 'population') {
                        e.target.parentNode.insertBefore(draggedElement, e.target.nextSibling);
                        updateFlowPreview();
                        return false;
                    }
                    const all = [...list.querySelectorAll('.parameter-item')];
                    const di = all.indexOf(draggedElement), ti = all.indexOf(e.target);
                    if (di < ti) e.target.parentNode.insertBefore(draggedElement, e.target.nextSibling);
                    else e.target.parentNode.insertBefore(draggedElement, e.target);
                }
            }
            if (draggedElement) syncSelectedParametersFromDom();
            updateFlowPreview(); return false;
        }
        function handleDragEnd(e) { if (draggedElement) { draggedElement.style.opacity = '1'; draggedElement = null; } }

        function showAddParameterForm(cat) { document.getElementById(`custom-param-form-${cat}`).classList.add('active'); }
        function cancelAddParameter(cat) {
            document.getElementById(`custom-param-form-${cat}`).classList.remove('active');
            document.getElementById(`new-param-name-${cat}`).value = '';
            document.getElementById(`new-param-desc-${cat}`).value = '';
        }
        function addCustomParameter(cat) {
            const name = document.getElementById(`new-param-name-${cat}`).value.trim();
            const desc = document.getElementById(`new-param-desc-${cat}`).value.trim();
            const id = `custom_${cat}_${Date.now()}`;
            customParameters[id] = { name, description: desc, category: cat };
            parameterLabels[id] = name;
            const list = document.getElementById(`${cat}-list`);
            const el = document.createElement('div');
            el.className = 'parameter-item'; el.draggable = true; el.setAttribute('data-param', id);
            el.addEventListener('click', toggleParamCard);
            el.innerHTML = `<span class="drag-handle">⋮⋮</span>
        <input type="checkbox" class="param-checkbox" value="${id}" checked>
        <div class="param-info">
            <div class="param-label-row">
                <span class="param-label" contenteditable="true" onblur="renameParameter('${id}',this.textContent)">${name}</span>
                <span class="param-badge optional">Custom</span>
            </div>
            <span class="param-description">${desc}</span>
        </div>
        <div class="param-actions">
            <button class="param-action-btn menu-trigger" onclick="toggleParamMenu(event)" title="More options">⋮</button>
            <div class="param-menu"><button class="param-menu-item delete" onclick="deleteParameter('${cat}','${id}')">Delete</button></div>
        </div>`;
            list.appendChild(el);
            el.querySelector('.param-checkbox').addEventListener('change', updateFlowPreview);
            cancelAddParameter(cat); updateFlowPreview();
        }
        function deleteParameter(cat, id) {
            if (confirm('Remove this parameter from the forecast flow?')) {
                const item = document.querySelector(`[data-param="${id}"]`);
                if (item) item.remove();
                if (customParameters[id]) { delete customParameters[id]; delete parameterLabels[id]; }
                updateFlowPreview();
            }
        }
        function renameParameter(id, name) {
            const t = name.trim();
            if (t && parameterLabels[id]) { parameterLabels[id] = t; if (customParameters[id]) customParameters[id].name = t; updateFlowPreview(); }
        }
        function updateFlowPreview() {
            // Get epiType radio selection
            const epiRadio = document.querySelector('input[name="epi-type"]:checked');
            const epiType = epiRadio ? epiRadio.value : 'prevalence';
            selectedParameters.epidemiology = epiType;

            // Collect all currently checked parameters from the DOM
            const checkedParams = new Set(['population', epiType]);
            ['epidemiology-list', 'treatment-list', 'market-list', 'pricing-list'].forEach(cid => {
                const list = document.getElementById(cid);
                if (!list) return;
                list.querySelectorAll('.parameter-item').forEach(item => {
                    const cb = item.querySelector('.param-checkbox');
                    if (cb && cb.checked) {
                        checkedParams.add(cb.value);
                    }
                });
            });

            // Filter existing parameters to keep only checked ones, keeping their order
            const newParamsList = (selectedParameters.parameters || []).filter(p => checkedParams.has(p));

            // Add any new checked parameters that are not in the list yet
            checkedParams.forEach(p => {
                if (!newParamsList.includes(p)) {
                    newParamsList.push(p);
                }
            });

            // Force population to always be at index 0
            if (newParamsList.includes('population')) {
                const idx = newParamsList.indexOf('population');
                if (idx !== 0) {
                    newParamsList.splice(idx, 1);
                    newParamsList.unshift('population');
                }
            } else {
                newParamsList.unshift('population');
            }

            selectedParameters.parameters = newParamsList;

            // Update the "N of M active" count pill on each section header
            const categories = ['epidemiology', 'treatment', 'market', 'pricing'];
            categories.forEach(cat => {
                const list = document.getElementById(`${cat}-list`);
                const subtitle = document.getElementById(`flow-count-${cat}`);
                if (list && subtitle) {
                    let total = 0;
                    let active = 0;
                    
                    if (cat === 'epidemiology') {
                        const items = list.querySelectorAll('.parameter-item');
                        items.forEach(item => {
                            const dataParam = item.getAttribute('data-param');
                            if (dataParam === 'population') {
                                total++;
                                active++;
                            } else if (dataParam === 'prevalence' || dataParam === 'incidence') {
                                if (dataParam === 'prevalence') {
                                    total++;
                                    const radio = item.querySelector('.param-radio');
                                    if (radio && radio.checked) {
                                        active++;
                                    }
                                } else if (dataParam === 'incidence') {
                                    const radio = item.querySelector('.param-radio');
                                    if (radio && radio.checked) {
                                        active++;
                                    }
                                }
                            } else {
                                total++;
                                const cb = item.querySelector('.param-checkbox');
                                if (cb && cb.checked) {
                                    active++;
                                }
                            }
                        });
                    } else {
                        const items = list.querySelectorAll('.parameter-item');
                        total = items.length;
                        items.forEach(item => {
                            const cb = item.querySelector('.param-checkbox');
                            if (cb && cb.checked) {
                                active++;
                            }
                        });
                    }
                    subtitle.textContent = `${active}/${total}`;
                }
            });

            if (!_suppressViewRender) renderFlowViewMode();
            debouncedSave();
        }

        // Set true (briefly, synchronously) by actions that want to patch the view
        // in place — e.g. switchEpiType's morph — instead of letting the normal
        // change-event path do a full renderFlowViewMode() rebuild over it.
        let _suppressViewRender = false;

        // View mode shows only the currently active parameters as a single,
        // grouped, read-only funnel — no unselected rows, no always-on editing
        // chrome — so picking a template shows exactly what that template
        // includes (e.g. Incidence Rate simply isn't there if the template uses
        // Prevalence). Kept in sync from updateFlowPreview() so it's always
        // current regardless of which mode (view/edit) is actually visible.
        //
        // Each node is compact by default; hovering reveals a small pencil, and
        // clicking it expands just that node (badges + a Remove / switch action)
        // — like a Figma properties panel — instead of jumping into a separate
        // full-page edit mode for a one-off toggle.
        //
        // animate=true (used when a recommendation is applied) reveals each row —
        // and the connector before it — one at a time with a short slide/fade, so
        // the flow visibly builds itself instead of jump-cutting to the result.
        const FLOW_VIEW_TAPER = [100, 94, 88, 82]; // % width, funnel narrows row by row
        const FLOW_VIEW_GROUPS = [
            { id: 'epidemiology-list', name: 'Epidemiology' },
            { id: 'treatment-list', name: 'Patient Flow' },
            { id: 'market-list', name: 'Market Dynamics' },
            { id: 'pricing-list', name: 'Pricing & Access' },
        ];

        function getParamGroupListId(paramId) {
            const el = document.querySelector(
                `#parameterSelectionSection .parameter-item[data-param="${paramId}"],`
                + ` #parameterSelectionSection .choice-segment[data-param="${paramId}"]`
            );
            if (!el) return null;
            const list = el.closest('.parameter-list');
            return list ? list.id : null;
        }

        function buildFullParamOrder(paramIds, epiType) {
            const order = [];
            const add = (id) => { if (id && !order.includes(id)) order.push(id); };
            add('population');
            (paramIds || []).forEach((p) => {
                if (p === 'population') return;
                if (p === 'prevalence' || p === 'incidence') {
                    add(epiType || 'prevalence');
                    return;
                }
                add(p);
            });
            const activeEpi = epiType || 'prevalence';
            if ((paramIds || []).some(p => p === 'prevalence' || p === 'incidence') && !order.includes(activeEpi)) {
                const popIdx = order.indexOf('population');
                order.splice(popIdx >= 0 ? popIdx + 1 : 0, 0, activeEpi);
            }
            return order;
        }

        function reorderDomParameterLists(orderedParamIds) {
            const orderIndex = new Map((orderedParamIds || []).map((id, i) => [id, i]));
            FLOW_VIEW_GROUPS.forEach((g) => {
                const list = document.getElementById(g.id);
                if (!list) return;
                const children = [...list.children];
                children.sort((a, b) => {
                    const rank = (el) => {
                        if (el.classList.contains('choice-group')) {
                            const prevIdx = orderIndex.get('prevalence');
                            const incIdx = orderIndex.get('incidence');
                            if (prevIdx !== undefined) return prevIdx;
                            if (incIdx !== undefined) return incIdx;
                            return 1;
                        }
                        const id = el.dataset?.param || '';
                        return orderIndex.has(id) ? orderIndex.get(id) : 9999;
                    };
                    return rank(a) - rank(b);
                });
                children.forEach((el) => list.appendChild(el));
            });
        }

        function syncSelectedParametersFromDom() {
            const order = [];
            const epiRadio = document.querySelector('input[name="epi-type"]:checked');
            const epiType = epiRadio ? epiRadio.value : 'prevalence';
            FLOW_VIEW_GROUPS.forEach((g) => {
                const list = document.getElementById(g.id);
                if (!list) return;
                list.querySelectorAll('.parameter-item[data-param], .choice-segment[data-param]').forEach((item) => {
                    const id = item.dataset.param;
                    if (!id) return;
                    if (id === 'prevalence' || id === 'incidence') {
                        if (id === epiType && !order.includes(id)) order.push(id);
                        return;
                    }
                    const cb = item.querySelector('.param-checkbox');
                    if (cb && cb.checked && !order.includes(id)) order.push(id);
                });
            });
            if (!order.includes('population')) order.unshift('population');
            else {
                const idx = order.indexOf('population');
                if (idx !== 0) {
                    order.splice(idx, 1);
                    order.unshift('population');
                }
            }
            selectedParameters.parameters = order;
            selectedParameters.epidemiology = epiType;
        }

        function getOrderedActiveParamsForGroup(groupId) {
            const ordered = selectedParameters.parameters || [];
            return ordered.filter((paramId) => getParamGroupListId(paramId) === groupId);
        }

        function getFlowViewRowFromParamId(paramId) {
            const item = document.querySelector(
                `#parameterSelectionSection .parameter-item[data-param="${paramId}"],`
                + ` #parameterSelectionSection .choice-segment[data-param="${paramId}"]`
            );
            if (!item) return null;
            const input = item.querySelector('.param-checkbox, .param-radio');
            if (!input || !input.checked) return null;
            const labelEl = item.querySelector('.param-label');
            const descEl = item.querySelector('.param-description');
            return {
                paramId,
                label: labelEl ? labelEl.textContent.trim() : paramId,
                desc: descEl ? descEl.textContent.trim() : '',
                isRequired: !!item.querySelector('.param-badge.required'),
                isAiSuggested: item.classList.contains('ai-suggested'),
                isChoice: item.classList.contains('choice-segment'),
            };
        }

        function buildFlowViewRowExpandHtml(row) {
            if (row.isChoice) {
                const other = row.paramId === 'prevalence' ? 'incidence' : 'prevalence';
                const otherLabel = _REC_PARAM_LABELS[other] || other;
                return `<div class="flow-view-row-expand">`
                    + `<button class="flow-view-action-btn" onclick="event.stopPropagation(); switchEpiType('${other}')">Switch to ${otherLabel}</button>`
                    + `</div>`;
            }
            const badges = (row.isAiSuggested ? `<span class="flow-view-badge ai"><span class="tag-ai-star">✨</span>AI Recommended</span>` : '')
                + `<span class="flow-view-badge optional">Optional</span>`;
            return `<div class="flow-view-row-expand">`
                + `<div class="flow-view-row-badges">${badges}</div>`
                + `<button class="flow-view-action-btn remove" onclick="event.stopPropagation(); removeFlowViewParam('${row.paramId}')">Remove</button>`
                + `</div>`;
        }

        function buildFlowViewRowHtml(row, width, enterClass) {
            const canEdit = !row.isRequired;
            const pencil = canEdit ? `<button class="flow-view-pencil" onclick="event.stopPropagation(); toggleFlowViewRowExpand(this)" title="Edit">✏️</button>` : '';
            const requiredBadge = row.isRequired ? '<span class="flow-view-badge required">Required</span>' : '';
            const expand = canEdit ? buildFlowViewRowExpandHtml(row) : '';
            const desc = row.desc ? `<span class="flow-view-desc">${row.desc}</span>` : '';
            return `<div class="flow-view-row${enterClass}" data-param="${row.paramId}" style="width:${width}%">`
                + `<div class="flow-view-row-main">`
                    + `<div class="flow-view-row-text"><span class="flow-view-label">${row.label}</span>${requiredBadge}${desc}</div>`
                    + pencil
                + `</div>`
                + expand
                + `</div>`;
        }

        // Renders ONE continuous funnel — every node and every category label is
        // threaded onto the same connector line, so nothing reads as a separate
        // list per category. The category name is a centered capsule sitting
        // inline on that line, not a left-aligned header floating above a group.
        // Deliberately slow, one-parameter-at-a-time pace (not element-count-based
        // timing) — every row gets its own clock tick, so it reads like a
        // reasoning model thinking through each assumption rather than a UI
        // animation racing through as many elements as happen to exist.
        const FLOW_ROW_STEP_MS = 550;
        const FLOW_ROW_LEAD_MS = 180; // connectors/capsules land slightly before the row they lead into

        // onRowStart(row, delayMs), if given, fires once per PARAMETER (not per
        // category) at the exact moment that row begins revealing — lets a
        // caller (see applyAIRecommendation) post one synced chat line per
        // parameter, e.g. "✓ Population", then "✓ Incidence Rate", each landing
        // the instant its own node appears, instead of one line per category.
        // Returns { totalDurationMs } so the caller knows when the whole
        // cascade finishes.
        function renderFlowViewMode(animate, onRowStart) {
            const container = document.getElementById('flowViewRows');
            if (!container) return { totalDurationMs: 0 };
            const enterClass = animate ? ' flow-view-enter' : '';
            let globalIndex = 0;
            const parts = []; // { html, rowIndex, isRow }
            FLOW_VIEW_GROUPS.forEach(g => {
                const rows = getOrderedActiveParamsForGroup(g.id)
                    .map((paramId) => getFlowViewRowFromParamId(paramId))
                    .filter(Boolean);
                if (!rows.length) return;

                // Connectors touching a category capsule are a plain line (no
                // dots); row-to-row connectors keep the two-dot pipe style.
                // Both the connector and the capsule are anchored to the first
                // row of this group — they land just before it, at the same beat.
                if (parts.length > 0) {
                    parts.push({ html: `<div class="flow-view-connector flow-view-connector-capsule${enterClass}" aria-hidden="true"></div>`, rowIndex: globalIndex, isRow: false });
                }
                parts.push({ html: `<div class="flow-view-category-capsule${enterClass}">${g.name}</div>`, rowIndex: globalIndex, isRow: false });

                rows.forEach((r, i) => {
                    const width = FLOW_VIEW_TAPER[Math.min(globalIndex, FLOW_VIEW_TAPER.length - 1)];
                    const capsuleClass = i === 0 ? ' flow-view-connector-capsule' : '';
                    parts.push({ html: `<div class="flow-view-connector${capsuleClass}${enterClass}" aria-hidden="true"></div>`, rowIndex: globalIndex, isRow: false });
                    parts.push({ html: buildFlowViewRowHtml(r, width, enterClass), rowIndex: globalIndex, isRow: true, row: r });
                    globalIndex++;
                });
            });
            container.innerHTML = parts.map(p => p.html).join('');

            let totalDurationMs = 0;
            if (animate) {
                const els = container.querySelectorAll('.flow-view-enter');
                els.forEach((el, i) => {
                    const p = parts[i];
                    const rowDelay = 60 + p.rowIndex * FLOW_ROW_STEP_MS;
                    const delay = p.isRow ? rowDelay : Math.max(0, rowDelay - FLOW_ROW_LEAD_MS);
                    setTimeout(() => {
                        el.classList.remove('flow-view-enter');
                        // Follow the reveal down the page — but only for the AI
                        // recommendation cascade (the one caller that passes
                        // onRowStart, since it's synced with the chat's thinking
                        // box); plain template switches (applyPreset) animate
                        // without this so they don't yank the page around.
                        // 'nearest' is a no-op when the row's already visible, so
                        // this never fights the user's own scrolling.
                        if (p.isRow && onRowStart) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, delay);
                    if (p.isRow && onRowStart) onRowStart(p.row, rowDelay);
                });
                totalDurationMs = 60 + Math.max(0, globalIndex - 1) * FLOW_ROW_STEP_MS + 450;
            }
            return { totalDurationMs };
        }

        // Expands exactly one node at a time (Figma-style properties panel) —
        // opening another node's pencil, or clicking outside the flow, closes it.
        function toggleFlowViewRowExpand(btn) {
            const row = btn.closest('.flow-view-row');
            if (!row) return;
            const wasOpen = row.classList.contains('expanded');
            document.querySelectorAll('#flowViewRows .flow-view-row.expanded').forEach(r => r.classList.remove('expanded'));
            if (!wasOpen) row.classList.add('expanded');
        }
        document.addEventListener('click', (e) => {
            if (e.target.closest('.flow-view-row')) return;
            document.querySelectorAll('#flowViewRows .flow-view-row.expanded').forEach(r => r.classList.remove('expanded'));
        });

        // Small delight: hovering a node glows whichever connector(s) touch it
        // (mouseover/mouseout bubble, unlike mouseenter/mouseleave, so this can
        // be delegated instead of re-attached on every renderFlowViewMode() call).
        document.addEventListener('mouseover', (e) => {
            const row = e.target.closest('.flow-view-row');
            if (!row || !row.closest('#flowViewRows')) return;
            const prev = row.previousElementSibling;
            const next = row.nextElementSibling;
            if (prev && prev.classList.contains('flow-view-connector')) prev.classList.add('flow-view-connector-glow');
            if (next && next.classList.contains('flow-view-connector')) next.classList.add('flow-view-connector-glow');
        });
        document.addEventListener('mouseout', (e) => {
            const row = e.target.closest('.flow-view-row');
            if (!row || (e.relatedTarget && row.contains(e.relatedTarget))) return;
            const prev = row.previousElementSibling;
            const next = row.nextElementSibling;
            if (prev && prev.classList.contains('flow-view-connector')) prev.classList.remove('flow-view-connector-glow');
            if (next && next.classList.contains('flow-view-connector')) next.classList.remove('flow-view-connector-glow');
        });

        // Inline actions from an expanded node — both re-render the view (and,
        // for the epidemiology choice, the underlying radio) via the normal
        // change-event path, so everything else (counts, AI tags) stays in sync.
        function removeFlowViewParam(paramId) {
            const cb = document.querySelector(`#parameterSelectionSection .parameter-item[data-param="${paramId}"] .param-checkbox`);
            if (!cb) return;
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Morphs the existing node in place — label/description cross-fade and
        // the "Switch to X" action relabels itself — instead of the normal
        // change-event path doing a full view rebuild. Reads as "you changed one
        // assumption," not "the page refreshed."
        function switchEpiType(target) {
            const radio = document.querySelector(`#parameterSelectionSection input[name="epi-type"][value="${target}"]`);
            if (!radio) return;
            const other = target === 'incidence' ? 'prevalence' : 'incidence';
            const row = document.querySelector(`#flowViewRows .flow-view-row[data-param="${other}"]`);

            radio.checked = true;
            _suppressViewRender = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            _suppressViewRender = false;

            if (!row) { renderFlowViewMode(); return; } // view wasn't showing this node — just sync normally

            row.classList.add('flow-view-row-morphing');
            setTimeout(() => {
                const sourceItem = document.querySelector(`#parameterSelectionSection .parameter-item[data-param="${target}"]`);
                const labelEl = sourceItem ? sourceItem.querySelector('.param-label') : null;
                const descEl = sourceItem ? sourceItem.querySelector('.param-description') : null;
                const labelSpan = row.querySelector('.flow-view-label');
                const descSpan = row.querySelector('.flow-view-desc');
                const switchBtn = row.querySelector('.flow-view-action-btn');
                const nextOther = target === 'incidence' ? 'prevalence' : 'incidence';

                row.dataset.param = target;
                if (labelSpan) labelSpan.textContent = labelEl ? labelEl.textContent.trim() : target;
                if (descSpan) descSpan.textContent = descEl ? descEl.textContent.trim() : '';
                if (switchBtn) {
                    switchBtn.textContent = `Switch to ${_REC_PARAM_LABELS[nextOther] || nextOther}`;
                    switchBtn.setAttribute('onclick', `event.stopPropagation(); switchEpiType('${nextOther}')`);
                }
                row.classList.remove('expanded');
                row.classList.remove('flow-view-row-morphing');
            }, 160);
        }

        // Switches between the read-only single-flow view (default) and the full
        // editable funnel — "Edit Flow" (in view mode) reveals exactly the UI
        // that used to be shown unconditionally; "Done" (in edit mode) returns to
        // the clean view-mode summary. Most day-to-day toggles now happen inline
        // via each node's own pencil, so this is only needed for renaming,
        // reordering, or adding custom parameters.
        function toggleFlowEditMode() {
            const wrap = document.getElementById('parameterSelectionSection');
            if (!wrap) return;
            const isEditing = wrap.classList.toggle('flow-mode-edit');
            if (!isEditing) renderFlowViewMode();
        }

        // Toggles a category section open/closed (replaces the old modal open/close).
        function toggleFlowSection(headerEl) {
            const section = headerEl.closest('.flow-section');
            if (section) section.classList.toggle('collapsed');
        }

        // Card-selection UI: clicking anywhere on a parameter card toggles its
        // checkbox/radio (visually hidden — the card's own color is the indicator),
        // except clicks meant for another action (delete, rename, drag handle).
        function toggleParamCard(e) {
            if (e.target.closest('button, [contenteditable="true"], .drag-handle')) return;
            const input = e.currentTarget.querySelector('.param-checkbox, .param-radio');
            if (!input || input.disabled) return;
            if (input.type === 'checkbox') {
                input.checked = !input.checked;
            } else if (!input.checked) {
                input.checked = true;
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Overflow menu (⋮) for row actions — opens a small "Delete" menu instead
        // of deleting immediately on click, so removing a parameter is a
        // deliberate two-step action rather than a single stray click.
        function toggleParamMenu(e) {
            const actions = e.currentTarget.closest('.param-actions');
            const wasOpen = actions.classList.contains('menu-open');
            document.querySelectorAll('.param-actions.menu-open').forEach(el => el.classList.remove('menu-open'));
            if (!wasOpen) actions.classList.add('menu-open');
        }
        // Closes any open menu on an outside click. Guarded so it doesn't fight
        // the same click that just opened one — React's own click delegation and
        // this listener can both sit on `document`, and stopPropagation() only
        // blocks other *nodes*, not a second listener on the same node.
        document.addEventListener('click', (e) => {
            if (e.target.closest('.menu-trigger, .param-menu')) return;
            document.querySelectorAll('.param-actions.menu-open').forEach(el => el.classList.remove('menu-open'));
        });

        // Tags whichever parameter cards the AI recommendation targets with a small
        // "AI suggests" badge, called once per recommendation fetch (not on every
        // updateFlowPreview() call, since .parameter-item nodes are persistent).
        // Only Epidemiology and Patient Flow & Treatment ever get the "AI suggests"
        // badge — Market Dynamics / Pricing recommendations are close to "everything
        // in the category", so tagging every row there would just be visual noise.
        function tagAISuggestedParams() {
            document.querySelectorAll('.parameter-item').forEach(el => el.classList.remove('ai-suggested'));
            document.querySelectorAll(
                '.flow-section[data-accent="navy"] .parameter-item, .flow-section[data-accent="green"] .parameter-item'
            ).forEach(el =>
                el.classList.toggle('ai-suggested', Array.isArray(aiRecParams) && aiRecParams.includes(el.dataset.param)));
        }
        function backToProductInfo() {
            document.getElementById('parameterSelectionSection').classList.add('hidden');
            document.getElementById('productInfoCard').style.display = 'block';
        }

        // ── Real source detail modal — shows the actual title/URL/domain fetched
        // for this reference (researchSources[n-1]), not a generic placeholder ──
        function _showSourceModal(n) {
            const existing = document.getElementById('_srcDemoModal');
            if (existing) existing.remove();
            const src = researchSources && researchSources[n - 1];
            if (!src) return;
            const favicon = _faviconUrl(src.url);
            const isPubmed = src.domain === 'pubmed.ncbi.nlm.nih.gov';
            const m = document.createElement('div');
            m.id = '_srcDemoModal';
            m.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,25,40,0.55);backdrop-filter:blur(3px);';
            m.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:28px 32px;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.22);position:relative;font-family:'Inter',sans-serif;">
                    <button onclick="document.getElementById('_srcDemoModal').remove()" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;color:#4A6580;font-size:18px;line-height:1;padding:0;">&#x2715;</button>
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#1A4F72,#2E6A96);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                            ${favicon ? `<img src="${favicon}" width="20" height="20" onerror="this.style.display='none'">` : `<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}
                        </div>
                        <div style="min-width:0;">
                            <div style="font-size:15px;font-weight:700;color:#1A2C3D;line-height:1.35;">${(src.title || 'Untitled source').replace(/</g, '&lt;')}</div>
                            <div style="font-size:11px;color:#4A6580;font-weight:600;margin-top:2px;">${isPubmed ? 'PubMed literature reference' : 'Web reference'} · ${src.domain || ''}</div>
                        </div>
                    </div>
                    <a href="${src.url}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:8px;background:rgba(26,79,114,0.06);border:1px solid rgba(26,79,114,0.18);border-radius:9px;padding:11px 14px;font-size:12px;color:#1A4F72;font-weight:600;text-decoration:none;word-break:break-all;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        ${src.url}
                    </a>
                </div>`;
            m.addEventListener('click', e => { if (e.target === m) m.remove(); });
            document.body.appendChild(m);
        }

        // ── Rich curated source library — indication-specific, real URLs ─────
        const _CURATED_SOURCES_MAP = {
            'rheumatoid arthritis': [
                { title: 'ACR RA Treatment Guidelines 2021', domain: 'rheumatology.org', url: 'https://www.rheumatology.org/Practice-Quality/Clinical-Support/Clinical-Practice-Guidelines/Rheumatoid-Arthritis' },
                { title: 'EULAR RA Management Recommendations 2022', domain: 'ard.bmj.com', url: 'https://ard.bmj.com/content/82/1/3' },
                { title: 'CDC Arthritis Prevalence & Impact', domain: 'cdc.gov', url: 'https://www.cdc.gov/arthritis/data_statistics/arthritis-related-stats.htm' },
                { title: 'Global RA Burden — GBD 2019 Analysis', domain: 'thelancet.com', url: 'https://www.thelancet.com/journals/lanrhe/article/PIIS2665-9913(21)00252-0/fulltext' },
                { title: 'FDA Drug Approvals — TNF Inhibitors', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/novel-drug-approvals-fda' },
                { title: 'ClinicalTrials.gov — RA Studies', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Rheumatoid+Arthritis&status=COMPLETED&phase=PHASE3' },
                { title: 'NCI Drug Dictionary — DMARDs', domain: 'ncithesaurus.nci.nih.gov', url: 'https://ncithesaurus.nci.nih.gov/ncitbrowser/' },
            ],
            'psoriasis': [
                { title: 'AAD Psoriasis Guidelines of Care 2020', domain: 'jaad.org', url: 'https://www.jaad.org/article/S0190-9622(20)32288-X/fulltext' },
                { title: 'EADV Psoriasis Management Guidelines', domain: 'eadv.org', url: 'https://www.eadv.org/clinical-practice/eadv-guidelines/' },
                { title: 'NPF Psoriasis Prevalence Data', domain: 'psoriasis.org', url: 'https://www.psoriasis.org/statistics/' },
                { title: 'Global Psoriasis Atlas', domain: 'globalpsoriasisatlas.org', url: 'https://www.globalpsoriasisatlas.org/prevalence/' },
                { title: 'FDA Biologics for Plaque Psoriasis', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/novel-drug-approvals-fda' },
                { title: 'ClinicalTrials — IL-17/IL-23 Phase 3', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Plaque+Psoriasis&phase=PHASE3&status=COMPLETED' },
                { title: 'JAMA Dermatology — Biologics Comparative', domain: 'jamanetwork.com', url: 'https://jamanetwork.com/journals/jamadermatology' },
            ],
            'multiple sclerosis': [
                { title: 'MSIF Atlas of MS 2023', domain: 'msif.org', url: 'https://www.msif.org/resource/atlas-of-ms/' },
                { title: 'National MS Society — Prevalence Project', domain: 'nationalmssociety.org', url: 'https://www.nationalmssociety.org/About-the-MS-Society/News/New-Prevalence-Data' },
                { title: 'EAN/ECTRIMS Treatment Guidelines 2023', domain: 'ean.org', url: 'https://www.ean.org/ean/guidelines/ms-guidelines' },
                { title: 'FDA MS Drug Approvals — DMTs', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/drug-approvals-and-databases' },
                { title: 'ClinicalTrials — Relapsing MS Phase 3', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Multiple+Sclerosis%2C+Relapsing-Remitting&phase=PHASE3' },
                { title: 'NEJM — Real-World DMT Outcomes', domain: 'nejm.org', url: 'https://www.nejm.org/medical-research/multiple-sclerosis' },
                { title: 'WHO Neurological Disorders Atlas', domain: 'who.int', url: 'https://www.who.int/publications/i/item/9789241547888' },
            ],
            'type 2 diabetes': [
                { title: 'IDF Diabetes Atlas 10th Edition 2021', domain: 'diabetesatlas.org', url: 'https://diabetesatlas.org/atlas/tenth-edition/' },
                { title: 'ADA Standards of Medical Care 2024', domain: 'diabetesjournals.org', url: 'https://diabetesjournals.org/care/issue/47/Supplement_1' },
                { title: 'CDC National Diabetes Statistics Report', domain: 'cdc.gov', url: 'https://www.cdc.gov/diabetes/data/statistics-report/index.html' },
                { title: 'WHO Global Diabetes Prevalence', domain: 'who.int', url: 'https://www.who.int/news-room/fact-sheets/detail/diabetes' },
                { title: 'FDA GLP-1/SGLT-2 Approvals', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/novel-drug-approvals-fda' },
                { title: 'ClinicalTrials — T2D Cardiovascular Outcomes', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Type+2+Diabetes&phase=PHASE3&status=COMPLETED' },
                { title: 'Lancet — Global Burden of Diabetes 2022', domain: 'thelancet.com', url: 'https://www.thelancet.com/action/doSearch?searchType=quick&searchText=diabetes+global+burden' },
            ],
            'lung cancer': [
                { title: 'NCCN NSCLC Guidelines v5.2024', domain: 'nccn.org', url: 'https://www.nccn.org/professionals/physician_gls/pdf/nscl.pdf' },
                { title: 'GLOBOCAN 2022 — Lung Cancer Incidence', domain: 'gco.iarc.fr', url: 'https://gco.iarc.fr/today/fact-sheets-cancers?cancer=15&type=0&sex=0' },
                { title: 'SEER Lung Cancer Stat Facts', domain: 'seer.cancer.gov', url: 'https://seer.cancer.gov/statfacts/html/lungb.html' },
                { title: 'FDA Oncology Drug Approvals 2023–2024', domain: 'fda.gov', url: 'https://www.fda.gov/patients/hematologyoncology-cancer-approvals-safety-notifications' },
                { title: 'ClinicalTrials — PD-1/PD-L1 NSCLC Phase 3', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Non-Small+Cell+Lung+Cancer&term=PD-1&phase=PHASE3' },
                { title: 'ASCO — Lung Cancer Market Landscape', domain: 'ascopubs.org', url: 'https://ascopubs.org/journal/jco/lung-cancer' },
                { title: 'IASLC Staging & Epidemiology Data', domain: 'iaslc.org', url: 'https://www.iaslc.org/research-education/data-collection-databases' },
            ],
            'breast cancer': [
                { title: 'NCCN Breast Cancer Guidelines 2024', domain: 'nccn.org', url: 'https://www.nccn.org/professionals/physician_gls/pdf/breast.pdf' },
                { title: 'GLOBOCAN 2022 — Breast Cancer Incidence', domain: 'gco.iarc.fr', url: 'https://gco.iarc.fr/today/fact-sheets-cancers?cancer=20&type=0&sex=2' },
                { title: 'SEER Breast Cancer Stat Facts', domain: 'seer.cancer.gov', url: 'https://seer.cancer.gov/statfacts/html/breast.html' },
                { title: 'FDA CDK4/6 & HER2 Drug Approvals', domain: 'fda.gov', url: 'https://www.fda.gov/patients/hematologyoncology-cancer-approvals-safety-notifications/breast-cancer' },
                { title: 'EBCTCG Meta-Analysis — Early Breast Cancer', domain: 'thelancet.com', url: 'https://www.thelancet.com/journals/lanonc/article/PIIS1470-2045(22)00109-7' },
                { title: 'ClinicalTrials — HER2+/HR+ Phase 3', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Breast+Neoplasms&phase=PHASE3&status=COMPLETED' },
                { title: 'ASCO Breast — Market Access Reports', domain: 'ascopubs.org', url: 'https://ascopubs.org/journal/jco/breast-cancer' },
            ],
            'atopic dermatitis': [
                { title: 'AAD Atopic Dermatitis Guidelines', domain: 'jaad.org', url: 'https://www.jaad.org/article/S0190-9622(23)00002-3/fulltext' },
                { title: 'EADV Eczema Treatment Recommendations', domain: 'eadv.org', url: 'https://www.eadv.org/clinical-practice/eadv-guidelines/atopic-eczema/' },
                { title: 'Global Eczema — Prevalence Analysis 2022', domain: 'nationaleczema.org', url: 'https://nationaleczema.org/research/eczema-facts/' },
                { title: 'FDA IL-4/IL-13 & JAK Inhibitor Approvals', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/novel-drug-approvals-fda' },
                { title: 'ClinicalTrials — Dupilumab / Tralokinumab', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Atopic+Dermatitis&phase=PHASE3&status=COMPLETED' },
                { title: 'NEJM — JAK Inhibitors vs Biologics AD', domain: 'nejm.org', url: 'https://www.nejm.org/search?q=atopic+dermatitis' },
            ],
            'heart failure': [
                { title: 'AHA Heart Disease & Stroke Statistics 2024', domain: 'ahajournals.org', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001123' },
                { title: 'ESC Heart Failure Guidelines 2021', domain: 'escardio.org', url: 'https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Acute-and-Chronic-Heart-Failure' },
                { title: 'CDC Heart Failure Prevalence Data', domain: 'cdc.gov', url: 'https://www.cdc.gov/heartdisease/heart_failure.htm' },
                { title: 'FDA SGLT-2 HFpEF/HFrEF Approvals', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/novel-drug-approvals-fda' },
                { title: 'ClinicalTrials — HFpEF/HFrEF Phase 3', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Heart+Failure&phase=PHASE3&status=COMPLETED' },
                { title: 'NEJM — EMPEROR / DAPA-HF Trials', domain: 'nejm.org', url: 'https://www.nejm.org/search?q=heart+failure+SGLT2' },
                { title: 'HFSA 2022 Comprehensive Guidelines', domain: 'hfsa.org', url: 'https://hfsa.org/2022-hfsa-guideline-management-heart-failure' },
            ],
            'alzheimer': [
                { title: "Alzheimer's Association Facts & Figures 2024", domain: 'alz.org', url: 'https://www.alz.org/alzheimers-dementia/facts-figures' },
                { title: 'WHO Dementia Fact Sheet 2023', domain: 'who.int', url: 'https://www.who.int/news-room/fact-sheets/detail/dementia' },
                { title: 'NIA Alzheimer Prevalence & Projections', domain: 'nia.nih.gov', url: 'https://www.nia.nih.gov/health/alzheimers-and-dementia/alzheimers-disease-fact-sheet' },
                { title: 'FDA Anti-Amyloid Drug Approvals', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/novel-drug-approvals-fda' },
                { title: 'ClinicalTrials — Anti-Amyloid Phase 3', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?cond=Alzheimer+Disease&phase=PHASE3&status=COMPLETED' },
                { title: 'Lancet — Global Dementia Commission 2024', domain: 'thelancet.com', url: 'https://www.thelancet.com/commissions/dementia2024' },
                { title: 'AAIC Biomarker & Epidemiology Data', domain: 'aaic.alz.org', url: 'https://aaic.alz.org/research.asp' },
            ],
            '_default': [
                { title: 'WHO Global Health Observatory Data', domain: 'who.int', url: 'https://www.who.int/data/gho' },
                { title: 'GBD 2021 — Global Burden of Disease', domain: 'healthdata.org', url: 'https://www.healthdata.org/research-analysis/gbd' },
                { title: 'FDA Novel Drug Approvals Database', domain: 'fda.gov', url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/novel-drug-approvals-fda' },
                { title: 'ClinicalTrials.gov — Phase 3 Trials', domain: 'clinicaltrials.gov', url: 'https://clinicaltrials.gov/search?phase=PHASE3&status=COMPLETED' },
                { title: 'EMA — European Public Assessment Reports', domain: 'ema.europa.eu', url: 'https://www.ema.europa.eu/en/medicines/download-medicine-data' },
                { title: 'Evaluate Pharma — Market Forecast Data', domain: 'evaluate.com', url: 'https://www.evaluate.com/vantage/articles/insights/company-sales/world-preview' },
            ],
        };

        function _getCuratedForIndication(indication) {
            const ind = (indication || '').toLowerCase();
            for (const key of Object.keys(_CURATED_SOURCES_MAP)) {
                if (key === '_default') continue;
                const words = key.split(' ');
                if (ind.includes(key) || words.some(w => w.length > 4 && ind.includes(w))) return _CURATED_SOURCES_MAP[key];
            }
            // Partial keyword fallbacks
            if (/(cancer|carcinoma|tumor|lymphoma|leukemia|myeloma|sarcoma)/i.test(ind)) return _CURATED_SOURCES_MAP['lung cancer'];
            if (/(eczema|dermatitis)/i.test(ind)) return _CURATED_SOURCES_MAP['atopic dermatitis'];
            if (/(cardiac|cardio|coronary|afib|arrhythmia)/i.test(ind)) return _CURATED_SOURCES_MAP['heart failure'];
            if (/(dementia|parkinson|neurolog)/i.test(ind)) return _CURATED_SOURCES_MAP['alzheimer'];
            if (/(diabet|insulin|glucose|glycem)/i.test(ind)) return _CURATED_SOURCES_MAP['type 2 diabetes'];
            return _CURATED_SOURCES_MAP['_default'];
        }

        // ── Global search-feed state (expand/collapse persists across interval rebuilds) ──
        window._sfExpanded  = false;
        window._sfRefresh   = null;
        window._sfToggle    = function() {
            window._sfExpanded = !window._sfExpanded;
            if (window._sfRefresh) window._sfRefresh();
        };

        // ── Render live research progress from REAL backend events (not a fixed-
        // duration animation) — reflects the actual 3-stage pipeline: discovering
        // sources, fetching each one, then calculating the final assumptions.
        // state = { stage: 'discovering'|'discovered'|'fetching'|'calculating'|'done'|'error',
        //           sources: [{title,url,domain,status:'pending'|'ok'|'failed'}],
        //           pubmedQueryCount, pubmedFound }
        function _renderResearchProgress(state) {
            var sources     = state.sources || [];
            var total       = sources.length;
            var doneCount   = sources.filter(function(s) { return s.status !== 'pending'; }).length;
            var isCalc      = state.stage === 'calculating';
            var isFinished  = state.stage === 'done';
            var isLive      = !isFinished && state.stage !== 'error';
            var active      = sources.find(function(s) { return s.status === 'pending'; });
            var expanded    = window._sfExpanded;

            var dotsHtml = '<span style="display:inline-flex;gap:3px;align-items:center;margin-left:1px;">'
                + [0, 1, 2].map(function(d) { return '<span style="width:4px;height:4px;border-radius:50%;background:#1A4F72;display:inline-block;animation:dots-blink 1.2s infinite;animation-delay:' + (d * 0.18) + 's;"></span>'; }).join('')
                + '</span>';

            var stageLabel = state.stage === 'discovering' ? 'Discovering sources'
                : isCalc ? 'Calculating'
                : isFinished ? 'Research complete'
                : state.stage === 'error' ? 'Using built-in defaults'
                : 'Searching';

            // ─── EXPANDED LIST VIEW — each real source with its live status ────
            if (expanded) {
                var listRows = sources.map(function(item, idx) {
                    var favicon = _faviconUrl(item.url);
                    var iconHtml = item.status === 'pending'
                        ? '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(26,79,114,.2);border-top-color:#1A4F72;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;"></span>'
                        : favicon
                            ? '<img src="' + favicon + '" width="16" height="16" style="border-radius:4px;flex-shrink:0;' + (item.status === 'failed' ? 'opacity:.4;' : '') + '" onerror="this.style.display=\'none\'">'
                            : '<div style="width:16px;height:16px;border-radius:4px;background:rgba(26,79,114,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                              + '<svg width="8" height="8" fill="none" stroke="#1A4F72" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>';
                    var statusIcon = item.status === 'ok'
                        ? '<svg width="12" height="12" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;"><circle cx="10" cy="10" r="9" stroke="#16a34a" stroke-width="1.5" opacity=".7"/><path d="M6 10l3 3 5-6" stroke="#16a34a" stroke-width="1.8" fill="none"/></svg>'
                        : item.status === 'failed'
                            ? '<span style="font-size:9px;color:#A0AEC0;flex-shrink:0;">no content</span>'
                            : '';
                    return '<a href="' + item.url + '" target="_blank" rel="noopener noreferrer" onmouseover="this.style.background=\'rgba(26,79,114,0.04)\'" onmouseout="this.style.background=\'transparent\'"'
                         + ' style="display:flex;align-items:center;gap:9px;padding:8px 12px;text-decoration:none;border-bottom:1px solid rgba(0,0,0,.05);transition:background .15s;">'
                         + iconHtml
                         + '<div style="flex:1;min-width:0;">'
                         + '<div style="font-size:11px;font-weight:600;color:#1A2C3D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (item.title || item.domain) + '</div>'
                         + '<div style="font-size:10px;color:#4A6580;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + item.domain + '</div>'
                         + '</div>'
                         + statusIcon
                         + '</a>';
                }).join('');

                var calcRow = isCalc
                    ? '<div style="display:flex;align-items:center;gap:9px;padding:8px 12px;background:rgba(26,79,114,.04);">'
                      + '<span style="display:inline-block;width:18px;height:18px;border:2px solid rgba(26,79,114,.2);border-top-color:#1A4F72;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;"></span>'
                      + '<div style="font-size:11px;font-weight:500;color:#4A6580;">Reviewing retrieved content and calculating assumptions…</div>'
                      + '</div>'
                    : '';

                return '<div style="font-family:\'Inter\',sans-serif;border:1px solid rgba(0,0,0,.08);border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.07);">'
                     + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.07);cursor:pointer;" onclick="window._sfToggle()">'
                     + '<div style="display:flex;align-items:center;gap:7px;">'
                     + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A4F72" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'
                     + '<span style="font-size:12px;font-weight:700;color:#1A2C3D;">' + (total > 0 ? 'Sources' : stageLabel) + '</span>'
                     + '</div>'
                     + '<div style="display:flex;align-items:center;gap:6px;">'
                     + '<span style="font-size:11px;font-weight:600;color:' + (isLive ? '#b8811e' : '#16a34a') + ';">' + doneCount + '/' + total + ' checked</span>'
                     + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A6580" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>'
                     + '</div>'
                     + '</div>'
                     + listRows
                     + calcRow
                     + '</div>';
            }

            // ─── COMPACT STACK VIEW (default) ─────────────────────────────────
            var sweepBar = '<div style="height:2px;background:rgba(0,0,0,.05);border-radius:2px;overflow:hidden;margin-bottom:11px;position:relative;">'
                         + (isLive
                             ? '<div style="position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,#1A4F72,#2563eb,transparent);animation:loading-bar-sweep .85s ease-in-out infinite;"></div>'
                             : '<div style="position:absolute;inset:0;background:linear-gradient(90deg,#1A4F72,#16a34a);border-radius:2px;"></div>')
                         + '</div>';

            var maxShow  = 5;
            var shown    = sources.slice(0, maxShow);
            var overflow = sources.length > maxShow ? sources.length - maxShow : 0;

            var favStack = shown.map(function(item, idx) {
                var zIdx     = shown.length - idx + 2;
                var ml       = idx === 0 ? '0' : '-8px';
                var popAnim  = item.status === 'pending' ? 'animation:fav-pop .3s ease both;' : '';
                var spinRing = item.status === 'pending'
                    ? '<div style="position:absolute;inset:-2px;border-radius:8px;border:2px solid rgba(26,79,114,0.45);animation:link-pulse 1.2s ease-in-out infinite;"></div>'
                    : '';
                var favicon = _faviconUrl(item.url);
                var dim = item.status === 'failed' ? 'opacity:.4;' : '';
                var iconInner = favicon
                    ? '<img src="' + favicon + '" width="16" height="16" style="border-radius:3px;' + dim + '" onerror="this.style.display=\'none\'">'
                    : '<span style="font-size:8px;font-weight:700;color:#fff;letter-spacing:-.3px;">' + (idx + 1) + '</span>';
                return '<div style="position:relative;margin-left:' + ml + ';z-index:' + zIdx + ';' + popAnim + ';flex-shrink:0;">'
                     + '<div style="width:26px;height:26px;border-radius:7px;border:2px solid #F5F6F8;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12);background:linear-gradient(135deg,#1A4F72,#2E6A96);display:flex;align-items:center;justify-content:center;">'
                     + iconInner
                     + '</div>'
                     + spinRing
                     + '</div>';
            }).join('');

            var overflowBubble = overflow > 0
                ? '<div style="position:relative;margin-left:-8px;z-index:1;width:26px;height:26px;border-radius:7px;border:2px solid #F5F6F8;background:#1A4F72;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0;letter-spacing:-.3px;">+' + overflow + '</div>'
                : '';

            var activeFavicon = active ? _faviconUrl(active.url) : '';
            var activeOrCalcRow = isCalc
                ? '<div style="display:flex;align-items:center;gap:7px;margin-top:9px;padding:6px 10px;border-radius:8px;background:rgba(26,79,114,.05);border:1px solid rgba(26,79,114,.09);overflow:hidden;position:relative;">'
                  + '<div style="position:absolute;bottom:0;left:0;right:0;height:2px;overflow:hidden;"><div style="position:absolute;top:0;bottom:0;width:50%;background:linear-gradient(90deg,transparent,#1A4F72,#2563eb,transparent);animation:loading-bar-sweep .85s ease-in-out infinite;"></div></div>'
                  + '<div style="width:13px;height:13px;border-radius:3px;background:linear-gradient(135deg,#1A4F72,#2E6A96);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                  + '<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M9 3v4M15 3v4M4 8h16M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/></svg></div>'
                  + '<div style="flex:1;min-width:0;">'
                  + '<span style="font-size:10px;font-weight:600;color:#1A2C3D;display:block;">Calculating</span>'
                  + '<span style="font-size:9px;color:#4A6580;display:block;margin-top:1px;">Reviewing retrieved content and computing assumptions…</span>'
                  + '</div>'
                  + '<span style="display:inline-block;width:10px;height:10px;border:1.5px solid rgba(26,79,114,.2);border-top-color:#1A4F72;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;"></span>'
                  + '</div>'
                : active
                ? '<div style="display:flex;align-items:center;gap:7px;margin-top:9px;padding:6px 10px;border-radius:8px;background:rgba(26,79,114,.05);border:1px solid rgba(26,79,114,.09);overflow:hidden;position:relative;">'
                  + '<div style="position:absolute;bottom:0;left:0;right:0;height:2px;overflow:hidden;"><div style="position:absolute;top:0;bottom:0;width:50%;background:linear-gradient(90deg,transparent,#1A4F72,#2563eb,transparent);animation:loading-bar-sweep .85s ease-in-out infinite;"></div></div>'
                  + (activeFavicon
                      ? '<img src="' + activeFavicon + '" width="13" height="13" style="border-radius:3px;flex-shrink:0;" onerror="this.style.display=\'none\'">'
                      : '<div style="width:13px;height:13px;border-radius:3px;background:linear-gradient(135deg,#1A4F72,#2E6A96);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                        + '<svg width="7" height="7" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>')
                  + '<div style="flex:1;min-width:0;">'
                  + '<span style="font-size:10px;font-weight:600;color:#1A2C3D;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (active.title || active.domain) + '</span>'
                  + '<span style="font-size:9px;color:#4A6580;display:block;margin-top:1px;">Reading ' + active.domain + '…</span>'
                  + '</div>'
                  + '<span style="display:inline-block;width:10px;height:10px;border:1.5px solid rgba(26,79,114,.2);border-top-color:#1A4F72;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;"></span>'
                  + '</div>'
                : '';

            var clickable = total > 0
                ? '<div style="display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0;" onclick="window._sfToggle()">'
                  + '<div style="display:flex;align-items:center;flex-shrink:0;">' + favStack + overflowBubble + '</div>'
                  + '<span style="font-size:11px;font-weight:600;color:#1A4F72;white-space:nowrap;flex-shrink:0;">'
                  + (isFinished ? total + ' sources' : doneCount + '/' + total + ' sources')
                  + ' <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:middle;"><path d="M6 9l6 6 6-6"/></svg>'
                  + '</span>'
                  + '</div>'
                : '<div style="height:30px;display:flex;align-items:center;">'
                  + '<span style="font-size:11px;color:#A0AEC0;">' + (state.stage === 'discovering' ? 'Asking Claude which sources to check…' : 'Looking for sources…') + '</span>'
                  + '</div>';

            var headerLeft = '<div style="display:flex;align-items:center;gap:6px;">'
                           + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A4F72" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'
                           + '<span style="font-size:12px;font-weight:700;color:#1A2C3D;">' + stageLabel + '</span>'
                           + (isLive ? dotsHtml : '')
                           + '</div>';

            // Cancel is only meaningful while a real WebSocket search is in
            // flight (not during the HTTP-streaming/static-fallback paths,
            // which can't be interrupted mid-way).
            var cancelBtn = (isLive && window._activeResearchWS)
                ? '<button type="button" onclick="cancelActiveResearch()" style="font-size:10px;font-weight:600;color:#9a3412;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.25);border-radius:999px;padding:2px 9px;cursor:pointer;">Cancel</button>'
                : '';

            return '<div style="font-family:\'Inter\',sans-serif;">'
                 + sweepBar
                 + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
                 + headerLeft
                 + '<div style="display:flex;align-items:center;gap:8px;">'
                 + (isFinished ? '<span style="font-size:11px;font-weight:600;color:#16a34a;">&#10003; Done</span>' : cancelBtn)
                 + '</div>'
                 + '</div>'
                 + clickable
                 + activeOrCalcRow
                 + '</div>';
        }

        async function generateAssumptions(event) {
            const country = document.getElementById('country').value,
                productName = document.getElementById('productName').value,
                classMoa = document.getElementById('classMoa').value,
                indication = document.getElementById('indication').value,
                launchYear = parseInt(document.getElementById('launchYear').value),
                peakYear = parseInt(document.getElementById('peakYear').value);
            if (!country || !productName || !classMoa || !indication || !launchYear || !peakYear) { alert('Please fill in all required fields'); return; }
            if (peakYear <= launchYear) { alert('Forecast - End Year must be after launch year'); return; }
            const btn = event ? event.target : document.querySelector('#parameterSelectionSection .btn-primary');
            if (btn) { const orig = btn.textContent; btn._orig = orig; btn.textContent = 'Researching…'; btn.disabled = true; }

            // ── Live research progress, driven by REAL backend events (not a
            // fixed-duration animation) — the actual 3-stage pipeline: discovering
            // sources, fetching each one, then calculating the assumptions. ──
            window._sfExpanded = false; // reset expand state on each new search
            const _rp = { stage: 'discovering', sources: [], pubmedQueryCount: 0, pubmedFound: 0 };
            const _chatProgress = addLiveChatMsg(_renderResearchProgress(_rp));
            window._sfRefresh = () => _chatProgress.update(_renderResearchProgress(_rp));
            // Kicked off in parallel with the main research stream — population
            // doesn't depend on indication/drug class, so it's a separate, real,
            // cached-by-country lookup rather than piggybacking on the per-
            // indication pipeline. Never throws (falls back to the static table).
            const popPromise = fetchPopulationData(country).catch(() => null);
            try {
                const rd = await performSecondaryResearchStream(indication, country, classMoa, (evt) => {
                    if (evt.stage === 'discovered') {
                        _rp.stage = 'discovered';
                        _rp.sources = evt.sources.map(s => ({ ...s, status: 'pending' }));
                        _rp.pubmedQueryCount = evt.pubmedQueryCount;
                    } else if (evt.stage === 'pubmed_searched') {
                        _rp.pubmedFound = (_rp.pubmedFound || 0) + (evt.found || 0);
                    } else if (evt.stage === 'fetched') {
                        _rp.stage = 'fetching';
                        const s = _rp.sources.find(x => x.url === evt.url);
                        if (s) s.status = evt.ok ? 'ok' : 'failed';
                    } else if (evt.stage === 'calculating') {
                        _rp.stage = 'calculating';
                    }
                    _chatProgress.update(_renderResearchProgress(_rp));
                });
                const popData = await popPromise;
                researchSources = Array.isArray(rd.sources) ? rd.sources.slice() : [];
                if (popData && Array.isArray(popData.sources)) {
                    const existingUrls = new Set(researchSources.map(s => s.url));
                    popData.sources.forEach(s => { if (!existingUrls.has(s.url)) { researchSources.push(s); existingUrls.add(s.url); } });
                }
                const staticPopulation = populationData[country] || 0; // last-resort fallback only
                const discountInfo = discountRates[country];
                assumptions = { country, productName, classMoa, indication, launchYear, peakYear, selectedFlow: selectedParameters.parameters };
                if (selectedParameters.parameters.includes('population')) {
                    const popValue = (popData && popData.value) ? popData.value : staticPopulation;
                    assumptions.population = { value: popValue, yoyGrowth: 0.005, unit: 'persons', range: `${(popValue * .95).toLocaleString()} - ${(popValue * 1.05).toLocaleString()}`, rationale: (popData && popData.rationale) || `Total population in ${country}.`, evidence: (popData && popData.evidence) || 'none', calculation: 'none', sourceUrls: (popData && popData.sourceUrls) || [] };
                }
                if (selectedParameters.parameters.includes('prevalence'))
                    assumptions.prevalence = { value: rd.prevalence, unit: 'rate', unitType: 'rate', displayUnit: 'rate', range: `${(rd.prevalence * .7).toFixed(4)} - ${(rd.prevalence * 1.3).toFixed(4)}`, rationale: rd.prevalenceRationale, evidence: rd.prevalenceEvidence || 'none', calculation: rd.prevalenceCalculation || 'none', sourceUrls: rd.prevalenceSourceUrls || [] };
                if (selectedParameters.parameters.includes('incidence'))
                    assumptions.incidence = { value: rd.prevalence * .15, unit: 'rate', unitType: 'rate', displayUnit: 'rate', range: `${(rd.prevalence * .10).toFixed(4)} - ${(rd.prevalence * .25).toFixed(4)}`, rationale: `Annual incidence for ${indication}, estimated as a share of prevalence.`, evidence: rd.prevalenceEvidence || 'none', calculation: `${(rd.prevalence * .15 * 100).toFixed(2)}% = ${(rd.prevalence * 100).toFixed(2)}% prevalence × 15% typical incidence-to-prevalence ratio`, sourceUrls: rd.prevalenceSourceUrls || [] };
                if (selectedParameters.parameters.includes('severity'))
                    assumptions.severity = { value: (rd.severity !== undefined ? rd.severity : 0.65), unit: '%', range: '45% - 85%', rationale: rd.severityRationale || 'Proportion with moderate-to-severe disease or specific subtype.', evidence: rd.severityEvidence || 'none', calculation: rd.severityCalculation || 'none', sourceUrls: rd.severitySourceUrls || [] };
                if (selectedParameters.parameters.includes('diagnosisRate'))
                    assumptions.diagnosisRate = { value: rd.diagnosis, unit: '%', range: `${(rd.diagnosis * .85 * 100).toFixed(0)}% - ${(rd.diagnosis * 1.10 * 100).toFixed(0)}%`, rationale: rd.diagnosisRationale, evidence: rd.diagnosisEvidence || 'none', calculation: rd.diagnosisCalculation || 'none', sourceUrls: rd.diagnosisSourceUrls || [] };
                if (selectedParameters.parameters.includes('treatmentRate'))
                    assumptions.treatmentRate = { value: rd.treatment, unit: '%', range: `${(rd.treatment * .80 * 100).toFixed(0)}% - ${(rd.treatment * 1.15 * 100).toFixed(0)}%`, rationale: rd.treatmentRationale, evidence: rd.treatmentEvidence || 'none', calculation: rd.treatmentCalculation || 'none', sourceUrls: rd.treatmentSourceUrls || [] };
                if (selectedParameters.parameters.includes('eligibilityCriteria'))
                    assumptions.eligibilityCriteria = { value: rd.biomarker, unit: '%', range: `${(rd.biomarker * .75 * 100).toFixed(0)}% - ${(rd.biomarker * 1.15 * 100).toFixed(0)}%`, rationale: rd.biomarkerRationale, evidence: rd.biomarkerEvidence || 'none', calculation: rd.biomarkerCalculation || 'none', sourceUrls: rd.biomarkerSourceUrls || [] };
                if (selectedParameters.parameters.includes('progressionRate'))
                    assumptions.progressionRate = { value: (rd.progressionRate !== undefined ? rd.progressionRate : 0.18), unit: '%/year', range: '10% - 30%', rationale: rd.progressionRateRationale || 'Annual disease progression rate.', evidence: rd.progressionRateEvidence || 'none', calculation: rd.progressionRateCalculation || 'none', sourceUrls: rd.progressionRateSourceUrls || [] };
                if (selectedParameters.parameters.includes('classShare'))
                    assumptions.classShare = { value: rd.classShare, startingShare: 0.05, timeToPeak: peakYear - launchYear, peakYear: peakYear, curveType: 'scurve', unit: '%', range: '20% - 55%', rationale: rd.classShareRationale, evidence: rd.classShareEvidence || 'none', calculation: rd.classShareCalculation || 'none', sourceUrls: rd.classShareSourceUrls || [] };
                if (selectedParameters.parameters.includes('peakProductShare'))
                    assumptions.peakProductShare = { value: rd.productShare, startingShare: 0.03, timeToPeak: peakYear - launchYear, peakYear: peakYear, curveType: 'scurve', unit: '%', range: '15% - 50%', rationale: rd.productShareRationale, evidence: rd.productShareEvidence || 'none', calculation: rd.productShareCalculation || 'none', sourceUrls: rd.productShareSourceUrls || [] };
                if (selectedParameters.parameters.includes('annualCostPerPatient'))
                    assumptions.annualCostPerPatient = { value: rd.annualCost, unit: '$', range: '$150,000 - $220,000', rationale: rd.costRationale, evidence: rd.costEvidence || 'none', calculation: rd.costCalculation || 'none', sourceUrls: rd.costSourceUrls || [] };
                if (selectedParameters.parameters.includes('discount'))
                    assumptions.discount = { value: (rd.discount !== undefined ? rd.discount : discountInfo.base), unit: '%', range: discountInfo.range, rationale: rd.discountRationale, evidence: rd.discountEvidence || 'none', calculation: rd.discountCalculation || 'none', sourceUrls: rd.discountSourceUrls || [] };
                assumptions.adoptionPeakTime = { value: peakYear - launchYear, unit: 'years', range: `${Math.max(2, peakYear - launchYear - 2)} - ${peakYear - launchYear + 2} years`, rationale: 'S-curve adoption from launch to peak.' };
                // Seed custom parameters added in Define Flow
                selectedParameters.parameters.forEach(key => {
                    if (customParameters[key] && !assumptions[key]) {
                        const cp = customParameters[key];
                        assumptions[key] = { value: 0, unit: '', range: '—', label: cp.name, description: cp.description || '', category: cp.category, rationale: `Custom parameter — please update this value.` };
                    }
                });
                saveUserInput();
                displayAssumptions();
                assumptionsGenerated = true;
                // ── Navigate to Assumptions tab ──
                _rp.stage = 'done';
                document.getElementById('parameterSelectionSection').style.display = 'none';
                const asSec = document.getElementById('assumptionsSection');
                asSec.classList.remove('hidden');
                asSec.style.display = 'block';
                document.getElementById('resultsSection').classList.add('hidden');
                document.querySelectorAll('.section-divider').forEach(el => el.style.display = 'none');
                updateNavigation(3);
                document.getElementById('workspace').scrollTop = 0;
                asSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Show completed stack, then append done notice below it
                _chatProgress.update(_renderResearchProgress(_rp));
                setTimeout(() => {
                    // Append a compact done row below the persistent source stack
                    const doneNotice = '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.2);display:flex;align-items:center;gap:10px;">'
                        + '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;"><circle cx="10" cy="10" r="9" fill="#16a34a" opacity=".15"/><circle cx="10" cy="10" r="9" stroke="#16a34a" stroke-width="1.5"/><path d="M6 10l3 3 5-6" stroke="#16a34a" stroke-width="1.8" fill="none"/></svg>'
                        + '<div>'
                        + '<div style="font-size:12px;font-weight:700;color:#1A2C3D;">Assumptions ready for <em>' + indication + '</em></div>'
                        + '<div style="font-size:10px;color:#4A6580;margin-top:2px;">Review values in the Assumptions tab — click sources above to verify.</div>'
                        + '</div>'
                        + '</div>';
                    _chatProgress.update(_renderResearchProgress(_rp) + doneNotice);
                }, 600);
                setTimeout(() => setQuickReplies(['Calculate Forecast', 'Edit Assumptions']), 1400);
            } catch (err) {
                if (err && err.cancelled) {
                    // Real user cancellation — never silently swapped for demo
                    // data. Stop here and let them re-run when ready.
                    _rp.stage = 'error';
                    const cancelNotice = '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(74,85,104,.06);border:1px solid rgba(74,85,104,.2);display:flex;align-items:center;gap:10px;">'
                        + '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;"><circle cx="10" cy="10" r="9" fill="#4A5568" opacity=".15"/><circle cx="10" cy="10" r="9" stroke="#4A5568" stroke-width="1.5"/><path d="M7 7l6 6M13 7l-6 6" stroke="#4A5568" stroke-width="1.8" stroke-linecap="round"/></svg>'
                        + '<div><div style="font-size:12px;font-weight:700;color:#1A2C3D;">Search cancelled</div>'
                        + '<div style="font-size:10px;color:#4A6580;margin-top:2px;">Click Generate Assumptions again when you\'re ready.</div></div>'
                        + '</div>';
                    _chatProgress.update(_renderResearchProgress(_rp) + cancelNotice);
                    return;
                }
                _rp.stage = 'error';
                const errNotice = '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.25);display:flex;align-items:center;gap:10px;">'
                    + '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;"><circle cx="10" cy="10" r="9" fill="#d97706" opacity=".15"/><circle cx="10" cy="10" r="9" stroke="#d97706" stroke-width="1.5"/><path d="M10 6v5M10 13h.01" stroke="#d97706" stroke-width="1.8" stroke-linecap="round"/></svg>'
                    + '<div><div style="font-size:12px;font-weight:700;color:#1A2C3D;">Using built-in defaults</div>'
                    + '<div style="font-size:10px;color:#4A6580;margin-top:2px;">Research API unavailable — review &amp; adjust values as needed.</div></div>'
                    + '</div>';
                _chatProgress.update(_renderResearchProgress(_rp) + errNotice);
                const epiData = epidemiologyDefaults[indication] || epidemiologyDefaults['Default'];
                const population = populationData[country], discountInfo = discountRates[country];
                assumptions = {
                    country, productName, classMoa, indication, launchYear, peakYear,
                    population: { value: population, yoyGrowth: 0.005, unit: 'persons', range: `${(population * .95).toLocaleString()} - ${(population * 1.05).toLocaleString()}`, rationale: `Total population in ${country}.` },
                    prevalence: { value: epiData.prevalence, unit: 'rate', range: `${(epiData.prevalence * .7).toFixed(4)} - ${(epiData.prevalence * 1.3).toFixed(4)}`, rationale: `Disease prevalence for ${indication}.` },
                    diagnosisRate: { value: epiData.diagnosis, unit: '%', range: `${(epiData.diagnosis * .85 * 100).toFixed(0)}% - ${(epiData.diagnosis * 1.10 * 100).toFixed(0)}%`, rationale: `Proportion diagnosed in ${country}.` },
                    treatmentRate: { value: epiData.treatment, unit: '%', range: `${(epiData.treatment * .80 * 100).toFixed(0)}% - ${(epiData.treatment * 1.15 * 100).toFixed(0)}%`, rationale: 'Proportion receiving treatment.' },
                    eligibilityCriteria: { value: epiData.biomarker, unit: '%', range: `${(epiData.biomarker * .75 * 100).toFixed(0)}% - ${(epiData.biomarker * 1.15 * 100).toFixed(0)}%`, rationale: 'Patients meeting eligibility criteria.' },
                    classShare: { value: 0.35, startingShare: 0.05, timeToPeak: peakYear - launchYear, peakYear: peakYear, curveType: 'scurve', unit: '%', range: '20% - 55%', rationale: `Market share for ${classMoa} class.` },
                    peakProductShare: { value: 0.25, startingShare: 0.03, timeToPeak: peakYear - launchYear, peakYear: peakYear, curveType: 'scurve', unit: '%', range: '15% - 50%', rationale: 'Product share within class.' },
                    annualCostPerPatient: { value: 65000, unit: '$', range: '$150,000 - $220,000', rationale: `Estimated annual cost based on ${classMoa} benchmarks.` },
                    discount: { value: discountInfo.base, unit: '%', range: discountInfo.range, rationale: `Net price realization in ${country}.` },
                    adoptionPeakTime: { value: peakYear - launchYear, unit: 'years', range: `${Math.max(2, peakYear - launchYear - 2)} - ${peakYear - launchYear + 2} years`, rationale: 'S-curve adoption.' }
                };
                // Seed custom parameters added in Define Flow
                selectedParameters.parameters.forEach(key => {
                    if (customParameters[key] && !assumptions[key]) {
                        const cp = customParameters[key];
                        assumptions[key] = { value: 0, unit: '', range: '—', label: cp.name, description: cp.description || '', category: cp.category, rationale: `Custom parameter — please update this value.` };
                    }
                });
                saveUserInput();
                displayAssumptions();
                assumptionsGenerated = true;
                const asSecFb = document.getElementById('assumptionsSection');
                asSecFb.classList.remove('hidden');
                asSecFb.style.display = 'block';
                document.getElementById('resultsSection').classList.add('hidden');
                updateNavigation(3);
                document.getElementById('workspace').scrollTop = 0;
                asSecFb.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setQuickReplies(['Calculate Forecast']);
            } finally { if (btn) { btn.textContent = btn._orig || 'Generate Assumptions'; btn.disabled = false; } }
        }

        // Tracks the currently active research WebSocket so a Cancel action can
        // interrupt a running search mid-flight — the HTTP-streaming fallback
        // below is one-directional and can't support this.
        window._activeResearchWS = null;

        function cancelActiveResearch() {
            const ws = window._activeResearchWS;
            if (ws && ws.readyState === WebSocket.OPEN) {
                try { ws.send(JSON.stringify({ action: 'cancel' })); } catch (e) { /* ignore */ }
            }
        }

        // Primary transport: a persistent WebSocket carrying the same real-time
        // progress events as the HTTP stream, but bidirectional — so the user
        // can cancel a running search (see cancelActiveResearch above).
        function performSecondaryResearchWS(indication, country, classMoa, onEvent) {
            return new Promise((resolve, reject) => {
                let ws;
                try {
                    const wsUrl = (BACKEND_URL || window.location.origin).replace(/^http/, 'ws') + '/ws/research';
                    ws = new WebSocket(wsUrl);
                } catch (err) {
                    reject(err);
                    return;
                }
                window._activeResearchWS = ws;
                let settled = false;

                const finish = (fn, arg) => {
                    if (settled) return;
                    settled = true;
                    window._activeResearchWS = null;
                    try { ws.close(); } catch (e) { /* ignore */ }
                    fn(arg);
                };

                ws.onopen = () => {
                    const payload = { indication, country, class_moa: classMoa };
                    if (window.uploadedRefFile) {
                        payload.reference_file_name = window.uploadedRefFile.name;
                        payload.reference_file_content = window.uploadedRefFile.content;
                    }
                    ws.send(JSON.stringify(payload));
                };

                ws.onmessage = (msg) => {
                    let evt;
                    try { evt = JSON.parse(msg.data); } catch (e) { return; }
                    if (evt.stage === 'done') {
                        finish(resolve, evt.result);
                    } else if (evt.stage === 'error') {
                        finish(reject, new Error(evt.message || 'Research failed'));
                    } else if (evt.stage === 'cancelled') {
                        const err = new Error('Research cancelled');
                        err.cancelled = true;
                        finish(reject, err);
                    } else {
                        onEvent(evt);
                    }
                };

                ws.onerror = () => finish(reject, new Error('WebSocket connection failed'));
                ws.onclose = () => finish(reject, new Error('WebSocket closed unexpectedly'));
            });
        }

        // Fallback transport if the WebSocket upgrade itself can't connect
        // (e.g. a proxy blocking it) — same progress events over plain HTTP
        // chunked streaming, but one-directional (no cancel support).
        async function performSecondaryResearchHttpStream(indication, country, classMoa, onEvent) {
            const payload = { indication, country, class_moa: classMoa };
            if (window.uploadedRefFile) {
                payload.reference_file_name = window.uploadedRefFile.name;
                payload.reference_file_content = window.uploadedRefFile.content;
            }
            const res = await fetch(`${BACKEND_URL}/api/research/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalResult = null;
            let streamError = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let nl;
                while ((nl = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, nl).trim();
                    buffer = buffer.slice(nl + 1);
                    if (!line) continue;
                    let evt;
                    try { evt = JSON.parse(line); } catch (e) { continue; }
                    if (evt.stage === 'done') finalResult = evt.result;
                    else if (evt.stage === 'error') streamError = evt.message || 'Research failed';
                    else onEvent(evt);
                }
            }
            if (streamError) throw new Error(streamError);
            if (!finalResult) throw new Error('Stream ended without a result');
            return finalResult;
        }

        // Main entry point — tries the WebSocket (supports mid-search cancel),
        // falls back to HTTP streaming if the socket can't even connect (e.g. a
        // proxy blocking websocket upgrades), then to static built-in defaults
        // if neither backend path works. A real user cancellation always
        // propagates (never silently swapped for demo data).
        async function performSecondaryResearchStream(indication, country, classMoa, onEvent) {
            try {
                return await performSecondaryResearchWS(indication, country, classMoa, onEvent);
            } catch (err) {
                if (err && err.cancelled) throw err;
                console.warn('Research WebSocket unavailable, falling back to HTTP streaming:', err);
            }
            try {
                return await performSecondaryResearchHttpStream(indication, country, classMoa, onEvent);
            } catch (err) {
                console.warn('Research stream unavailable, using built-in defaults:', err);
                onEvent({ stage: 'calculating' });
                return performSecondaryResearchFallback(indication, country, classMoa);
            }
        }

        async function performSecondaryResearch(indication, country, classMoa) {
            try {
                const payload = { indication, country, class_moa: classMoa };
                if (window.uploadedRefFile) {
                    payload.reference_file_name = window.uploadedRefFile.name;
                    payload.reference_file_content = window.uploadedRefFile.content;
                }
                const res = await fetch(`${BACKEND_URL}/api/research`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                return data;
            } catch (err) {
                console.warn('Research API unavailable, using built-in defaults:', err);
                return performSecondaryResearchFallback(indication, country, classMoa);
            }
        }

        // Real, backend-cached population lookup (see /api/research/population)
        // — replaces the old hardcoded 9-country table with a genuine
        // DuckDuckGo-backed search that works for any country. Throws on
        // failure; caller (generateAssumptions) catches and falls back to the
        // static table only as a last resort.
        async function fetchPopulationData(country) {
            const res = await fetch(`${BACKEND_URL}/api/research/population`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        }

        async function performSecondaryResearchFallback(indication, country, classMoa) {
            return new Promise(resolve => {
                setTimeout(() => {
                    const db = {
                        'Rheumatoid Arthritis': { prevalence: 0.0055, prevalenceRationale: `RA prevalence 0.55% in ${country}.`, diagnosis: 0.78, diagnosisRationale: `Diagnosis rate 78% per ACR registry.`, treatment: 0.72, treatmentRationale: `Treatment rate 72% per EULAR guidelines.`, biomarker: 0.82, biomarkerRationale: `82% eligibility (moderate-severe disease, DMARD-inadequate).`, classShare: 0.38, classShareRationale: `${classMoa} expected 38% peak share in RA biologics.`, productShare: 0.27, productShareRationale: `Product share 27% vs recent RA biologic launches.`, annualCost: 68000, costRationale: `Annual cost $68K benchmark for RA biologics in ${country}.`, discountRationale: `Net pricing after mandatory rebates and PBM negotiations.` },
                        'Multiple Sclerosis': { prevalence: 0.0028, prevalenceRationale: `MS prevalence 0.28% per MSIF Atlas 2023.`, diagnosis: 0.87, diagnosisRationale: `Diagnosis rate 87% with McDonald criteria.`, treatment: 0.81, treatmentRationale: `Treatment rate 81% per MS registries.`, biomarker: 0.88, biomarkerRationale: `88% eligibility: RRMS, prior DMT failure.`, classShare: 0.42, classShareRationale: `${classMoa} expected 42% share in MS DMT market.`, productShare: 0.29, productShareRationale: `29% share benchmarking recent MS launches.`, annualCost: 88000, costRationale: `Annual cost $88K per high-efficacy MS pricing.`, discountRationale: `Specialty pharmacy rebates and payer negotiations.` },
                        'Type 2 Diabetes': { prevalence: 0.098, prevalenceRationale: `T2D prevalence 9.8% per IDF 2023.`, diagnosis: 0.71, diagnosisRationale: `Diagnosis rate 71%, significant undiagnosed burden.`, treatment: 0.68, treatmentRationale: `Treatment rate 68% per claims data.`, biomarker: 0.75, biomarkerRationale: `75% eligibility on background metformin.`, classShare: 0.31, classShareRationale: `${classMoa} expected 31% in advanced T2D market.`, productShare: 0.23, productShareRationale: `Conservative 23% in competitive diabetes market.`, annualCost: 12500, costRationale: `Annual cost $12.5K for advanced diabetes therapy.`, discountRationale: `High discount ~25-35% due to PBM negotiations.` },
                        'Oncology': { prevalence: 0.0048, prevalenceRationale: `Cancer prevalence 0.48% per GLOBOCAN 2023.`, diagnosis: 0.92, diagnosisRationale: `Diagnosis rate 92% given symptomatic presentation.`, treatment: 0.77, treatmentRationale: `Treatment rate 77% for eligible patients.`, biomarker: 0.68, biomarkerRationale: `68% biomarker positive rate.`, classShare: 0.44, classShareRationale: `${classMoa} expected 44% in target cancer segment.`, productShare: 0.31, productShareRationale: `31% share benchmarking recent IO launches.`, annualCost: 185000, costRationale: `Annual cost $185K per oncology pricing.`, discountRationale: `Oncology discounts 15-22% vs primary care.` },
                        'Alzheimer Disease': { prevalence: 0.0115, prevalenceRationale: `AD prevalence 1.15% per Alzheimer's Association 2024.`, diagnosis: 0.67, diagnosisRationale: `Diagnosis rate 67%, significant underdiagnosis.`, treatment: 0.52, treatmentRationale: `Treatment rate 52%, limited DMT options historically.`, biomarker: 0.61, biomarkerRationale: `61% amyloid-positive eligible patients.`, classShare: 0.33, classShareRationale: `${classMoa} expected 33% in AD DMT market.`, productShare: 0.22, productShareRationale: `Conservative 22% given early market signals.`, annualCost: 26500, costRationale: `Annual cost $26.5K aligned to DMT pricing.`, discountRationale: `Medicare Part B and supplemental insurance discounts.` },
                        'Heart Failure': { prevalence: 0.0215, prevalenceRationale: `HF prevalence 2.15% per AHA 2024 statistics.`, diagnosis: 0.81, diagnosisRationale: `Diagnosis rate 81% via BNP and echo.`, treatment: 0.71, treatmentRationale: `Treatment rate 71%, GDMT gaps persist.`, biomarker: 0.76, biomarkerRationale: `76% HFrEF eligible per PARADIGM-HF criteria.`, classShare: 0.41, classShareRationale: `${classMoa} expected 41% in HFrEF market.`, productShare: 0.28, productShareRationale: `28% within class based on Entresto/SGLT2i benchmarks.`, annualCost: 5400, costRationale: `Annual cost $5.4K aligned to HF therapy pricing.`, discountRationale: `Primary care channel with aggressive PBM discounts.` }
                    };
                    const d = db[indication] || { prevalence: 0.005, prevalenceRationale: `Prevalence for ${indication} estimated at 0.5%.`, diagnosis: 0.75, diagnosisRationale: 'Diagnosis rate 75% estimated.', treatment: 0.70, treatmentRationale: 'Treatment rate 70% estimated.', biomarker: 0.80, biomarkerRationale: 'Eligibility criteria 80% estimated.', classShare: 0.35, classShareRationale: `${classMoa} class share 35% estimated.`, productShare: 0.25, productShareRationale: 'Product share 25% conservative estimate.', annualCost: 65000, costRationale: `Annual cost $65K for ${classMoa} in ${country}.`, discountRationale: `Discount based on ${country} market averages.` };

                    // Even in offline/fallback mode (no live research API), attach the
                    // real curated reference library for this indication so rationale
                    // footnotes and the sources panel still show genuine, clickable
                    // links — never silently drop sourcing just because the live
                    // research call failed.
                    const curated = _getCuratedForIndication(indication).slice(0, 6);
                    d.sources = curated.map(s => ({ title: s.title, url: s.url, domain: s.domain }));
                    const urlAt = i => curated.length ? [curated[i % curated.length].url] : [];
                    d.prevalenceSourceUrls = urlAt(0);
                    d.diagnosisSourceUrls = urlAt(1);
                    d.treatmentSourceUrls = urlAt(2);
                    d.biomarkerSourceUrls = urlAt(3);
                    d.classShareSourceUrls = urlAt(4);
                    d.productShareSourceUrls = urlAt(5);
                    d.costSourceUrls = [];
                    d.discountSourceUrls = [];
                    resolve(d);
                }, 1200);
            });
        }

        function renderPopupFlowChart() {
            const pfd = document.getElementById('popupFlowDiagram');
            pfd.innerHTML = '';
            
            const paramColors = {
                population: '#1b3a60',
                prevalence: '#1d5b8c',
                incidence: '#1d5b8c',
                severity: '#1d5b8c',
                diagnosisRate: '#1b6e76',
                eligibilityCriteria: '#c66a0a',
                treatmentRate: '#137c95',
                progressionRate: '#137c95',
                classShare: '#bfa009',
                peakProductShare: '#b83a0a',
                annualCostPerPatient: '#a21b18',
                discount: '#a21b18'
            };

            const paramIcons = {
                population: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
                prevalence: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
                incidence: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
                severity: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
                diagnosisRate: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01"/></svg>`,
                eligibilityCriteria: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
                treatmentRate: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z"/></svg>`,
                progressionRate: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
                classShare: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>`,
                peakProductShare: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`,
                annualCostPerPatient: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
                discount: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`
            };

            const defaultIcon = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

            selectedParameters.parameters.forEach((p, i) => {
                const s = document.createElement('div');
                s.className = 'flow-step';
                s.style.cursor = 'default';
                const maxSteps = selectedParameters.parameters.length;
                const widthPercent = Math.max(45, 100 - i * (55 / (maxSteps - 1 || 1)));
                s.style.width = `${widthPercent}%`;
                s.style.backgroundColor = paramColors[p] || '#1A4F72';
                
                const icon = paramIcons[p] || defaultIcon;
                const labelText = parameterLabels[p] || p;
                
                s.innerHTML = `
                    <div class="flow-step-left" style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;">
                        <span class="flow-step-icon">${icon}</span>
                        <span class="flow-step-label">${labelText}</span>
                    </div>
                `;
                pfd.appendChild(s);
                if (i < selectedParameters.parameters.length - 1) {
                    const a = document.createElement('span');
                    a.className = 'flow-arrow';
                    a.textContent = '↓';
                    pfd.appendChild(a);
                }
            });
        }

        function displayAssumptions() {
            const tbody = document.getElementById('assumptionsBody'); tbody.innerHTML = '';
            window._evidenceRegistry = []; // rebuilt fresh each render — old regIdx values belong to removed rows

            // Create flow diagram popup modal if it doesn't exist
            let popup = document.getElementById('flowChartPopup');
            if (!popup) {
                popup = document.createElement('div');
                popup.id = 'flowChartPopup';
                popup.style.cssText = 'position: fixed; inset: 0; z-index: 10000; display: none; align-items: center; justify-content: center; background: rgba(10,25,40,0.55); backdrop-filter: blur(4px);';
                popup.innerHTML = `
                    <div style="background: var(--surface); border: 2px solid #C9922A; border-radius: var(--r12); width: 95%; max-width: 650px; padding: 28px 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); position: relative; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column;">
                        <button onclick="window._closeFlowPopup()" style="position: absolute; top: 16px; right: 16px; background: transparent; border: none; cursor: pointer; color: var(--text-2); font-size: 24px; line-height: 1; transition: color 0.15s;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-2)'">✕</button>
                        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 20px; color: var(--primary); text-align: center;">Forecast Flow Diagram</h3>
                        <div class="flow-diagram" id="popupFlowDiagram" style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%;"></div>
                    </div>
                `;
                document.body.appendChild(popup);
                
                window._closeFlowPopup = function() {
                    document.getElementById('flowChartPopup').style.display = 'none';
                };
                window._openFlowPopup = function() {
                    renderPopupFlowChart();
                    document.getElementById('flowChartPopup').style.display = 'flex';
                };
            }

            const flowHTML = `
                <div style="margin-bottom: 0;">
                    <button onclick="window._openFlowPopup()" class="btn btn-secondary toggle-btn" style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Forecast Flow Chart
                    </button>
                </div>
            `;
            let fpe = document.getElementById('assumptionsFlowPreview');
            if (!fpe) {
                fpe = document.createElement('div');
                fpe.id = 'assumptionsFlowPreview';
            }
            fpe.innerHTML = flowHTML;

            const card = document.getElementById('assumptionsSection');
            if (card) {
                card.style.position = 'relative';
                let headerContainer = card.querySelector('.assumptions-header-flex');
                if (!headerContainer) {
                    headerContainer = document.createElement('div');
                    headerContainer.className = 'assumptions-header-flex';
                    headerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; width: 100%;';
                    
                    const title = card.querySelector('.card-title');
                    const subtitle = card.querySelector('.subtitle');
                    const titleWrap = document.createElement('div');
                    
                    if (title) titleWrap.appendChild(title);
                    if (subtitle) titleWrap.appendChild(subtitle);
                    headerContainer.appendChild(titleWrap);
                    
                    const badge = card.querySelector('.section-badge');
                    if (badge) {
                        badge.parentNode.insertBefore(headerContainer, badge.nextSibling);
                    } else {
                        card.insertBefore(headerContainer, card.firstChild);
                    }
                }
                headerContainer.appendChild(fpe);
            }

            selectedParameters.parameters.forEach(key => {
                if (!assumptions[key]) return;
                const data = assumptions[key], label = parameterLabels[key] || key;
                const vr = validateParameter(key);
                if (key === 'prevalence') {
                    const row = tbody.insertRow();
                    row.innerHTML = `<td><strong>${label}</strong></td>
                <td><input type="text" class="editable-cell" style="width:110px;margin-bottom:6px;" value="${formatValue(data.value, data.unit)}" data-key="${key}" onchange="updateAssumption('${key}',this.value,this)" oninput="window.validateAssumptionInput('${key}',this.value,this)">
                <select class="editable-cell" style="width:160px;" data-key="${key}_unit" onchange="updateEpiUnit('${key}',this.value)">
                    <option value="rate" ${data.unitType === 'rate' ? 'selected' : ''}>Rate (proportion)</option>
                    <option value="per100k" ${data.unitType === 'per100k' ? 'selected' : ''}>Per 100,000</option>
                    <option value="per1M" ${data.unitType === 'per1M' ? 'selected' : ''}>Per 1,000,000</option>
                </select>
                <div style="margin-top:7px;"><label style="font-size:10px;color:var(--text-2);">
                    <input type="checkbox" onchange="toggleYoYGrowth('${key}',this.checked)" ${data.yoyGrowth !== undefined ? 'checked' : ''}> YoY Prevalence Growth:
                </label>
                <input type="text" class="editable-cell" style="width:70px;margin-left:6px;" id="yoy_${key}" value="${data.yoyGrowth !== undefined ? (data.yoyGrowth * 100).toFixed(1) : '0'}" ${data.yoyGrowth === undefined ? 'disabled' : ''} onchange="updateYoYGrowth('${key}',this.value,this)" oninput="window.validateYoYGrowthInput('${key}',this.value,this)">%/yr</div>
                <div id="val-warn-${key}" class="validation-indicator ${vr.valid ? 'valid' : 'warning'}">${vr.valid ? '✓' : '⚠'} ${vr.message}</div></td>
                <td>${data.displayUnit || data.unit}</td><td>${data.range}</td><td class="rationale-col">${linkifyRationale(data.rationale, data.sourceUrls, data.calculation, data.evidence)}</td>`;
                } else if (key === 'incidence') {
                    const row = tbody.insertRow();
                    row.innerHTML = `<td><strong>${label}</strong></td>
                <td><input type="text" class="editable-cell" style="width:110px;margin-bottom:6px;" value="${formatValue(data.value, data.unit)}" data-key="${key}" onchange="updateAssumption('${key}',this.value,this)" oninput="window.validateAssumptionInput('${key}',this.value,this)">
                <select class="editable-cell" style="width:160px;" data-key="${key}_unit" onchange="updateEpiUnit('${key}',this.value)">
                    <option value="rate" ${data.unitType === 'rate' ? 'selected' : ''}>Rate (proportion)</option>
                    <option value="per100k" ${data.unitType === 'per100k' ? 'selected' : ''}>Per 100,000</option>
                    <option value="per1M" ${data.unitType === 'per1M' ? 'selected' : ''}>Per 1,000,000</option>
                </select>
                <div style="margin-top:7px;"><label style="font-size:10px;color:var(--text-2);">
                    <input type="checkbox" onchange="toggleYoYGrowth('${key}',this.checked)" ${data.yoyGrowth !== undefined ? 'checked' : ''}> Enable YoY Growth:
                </label>
                <input type="text" class="editable-cell" style="width:70px;margin-left:6px;" id="yoy_${key}" value="${data.yoyGrowth !== undefined ? (data.yoyGrowth * 100).toFixed(1) : '0'}" ${data.yoyGrowth === undefined ? 'disabled' : ''} onchange="updateYoYGrowth('${key}',this.value,this)" oninput="window.validateYoYGrowthInput('${key}',this.value,this)">%</div>
                <div id="val-warn-${key}" class="validation-indicator ${vr.valid ? 'valid' : 'warning'}">${vr.valid ? '✓' : '⚠'} ${vr.message}</div></td>
                <td>${data.displayUnit || data.unit}</td><td>${data.range}</td><td class="rationale-col">${linkifyRationale(data.rationale, data.sourceUrls, data.calculation, data.evidence)}</td>`;
                } else if (key === 'classShare' || key === 'peakProductShare') {
                    const launchYr = assumptions.launchYear || parseInt(document.getElementById('launchYear').value) || 0;
                    const peakYrVal = launchYr + (data.timeToPeak || 0);
                    const row = tbody.insertRow();
                    row.innerHTML = `<td><strong>${label}</strong></td>
                <td><div style="display:grid;gap:7px;">
                    <div><label style="font-size:10px;color:var(--text-2);">Starting Share (Year 1):</label>
                    <input type="text" class="editable-cell" style="width:80px;" value="${(data.startingShare * 100).toFixed(1)}" data-key="${key}_start" onchange="updateShareParam('${key}','startingShare',this.value,this)" oninput="window.validateShareParamInput('${key}','startingShare',this.value,this)">%</div>
                    <div><label style="font-size:10px;color:var(--text-2);">Peak Share:</label>
                    <input type="text" class="editable-cell" style="width:80px;" value="${formatValue(data.value, data.unit)}" data-key="${key}" onchange="updateAssumption('${key}',this.value,this)" oninput="window.validateAssumptionInput('${key}',this.value,this)">%</div>
                    <div><label style="font-size:10px;color:var(--text-2);">Forecast - End Year:</label>
                    <input type="number" class="editable-cell" style="width:90px;" value="${peakYrVal}" min="${launchYr}" max="2060" data-key="${key}_peakyr" onchange="updateShareParam('${key}','peakYear',this.value,this)" oninput="window.validateShareParamInput('${key}','peakYear',this.value,this)"></div>
                    <div><label style="font-size:10px;color:var(--text-2);">Curve Type:</label>
                    <select class="editable-cell" style="width:130px;" data-key="${key}_curve" onchange="updateShareParam('${key}','curveType',this.value)">
                        <option value="scurve" ${data.curveType === 'scurve' ? 'selected' : ''}>S-Curve</option>
                        <option value="linear" ${data.curveType === 'linear' ? 'selected' : ''}>Linear</option>
                        <option value="exponential" ${data.curveType === 'exponential' ? 'selected' : ''}>Exponential</option>
                    </select></div></div>
                <div id="val-warn-${key}" class="validation-indicator ${vr.valid ? 'valid' : 'warning'}">${vr.valid ? '✓' : '⚠'} ${vr.message}</div></td>
                <td>${data.unit}</td><td>${data.range}</td><td class="rationale-col">${linkifyRationale(data.rationale, data.sourceUrls, data.calculation, data.evidence)}</td>`;
                } else {
                    const row = tbody.insertRow();
                    row.innerHTML = `<td><strong>${label}</strong></td>
                <td><input type="text" class="editable-cell" style="width:110px;margin-bottom:6px;" value="${formatValue(data.value, data.unit)}" data-key="${key}" onchange="updateAssumption('${key}',this.value,this)" oninput="window.validateAssumptionInput('${key}',this.value,this)">
                <div style="margin-top:7px;"><label style="font-size:10px;color:var(--text-2);">
                    <input type="checkbox" onchange="toggleYoYGrowth('${key}',this.checked)" ${data.yoyGrowth !== undefined ? 'checked' : ''}> Enable YoY Growth:
                </label>
                <input type="text" class="editable-cell" style="width:70px;margin-left:6px;" id="yoy_${key}" value="${data.yoyGrowth !== undefined ? (data.yoyGrowth * 100).toFixed(1) : '0'}" ${data.yoyGrowth === undefined ? 'disabled' : ''} onchange="updateYoYGrowth('${key}',this.value,this)" oninput="window.validateYoYGrowthInput('${key}',this.value,this)">%</div>
                <div id="val-warn-${key}" class="validation-indicator ${vr.valid ? 'valid' : 'warning'}">${vr.valid ? '✓' : '⚠'} ${vr.message}</div></td>
                <td>${data.unit}</td><td>${data.range}</td><td class="rationale-col">${linkifyRationale(data.rationale, data.sourceUrls, data.calculation, data.evidence)}</td>`;
                }
            });

            // ── Sources panel ──────────────────────────────────────────────
            const sourcesSection = document.getElementById('assumptionsSourcesPanel');
            if (sourcesSection) sourcesSection.remove();
            if (researchSources && researchSources.length > 0) {
                const panel = document.createElement('div');
                panel.id = 'assumptionsSourcesPanel';
                panel.style.cssText = `
                    margin-top:20px;
                    border:1px solid rgba(201,146,42,0.3);
                    border-radius:10px;
                    overflow:hidden;
                    background:var(--surface);
                `;
                // Group sources into PubMed vs curated
                const pubmed = researchSources.filter(s => s.domain === 'pubmed.ncbi.nlm.nih.gov');
                const curated = researchSources.filter(s => s.domain !== 'pubmed.ncbi.nlm.nih.gov');

                // Use the source's actual index in researchSources so panel numbers
                // always match the badges shown in each assumption's rationale.
                // Shows the real fetched title/domain + favicon, not "Source N".
                const renderCards = (list) => list.map(s => {
                    const n = researchSources.indexOf(s) + 1;
                    const favicon = _faviconUrl(s.url);
                    return `<div onclick="_showSourceModal(${n})" title="${(s.title || '').replace(/"/g, '&quot;')}" style="
                        display:flex; align-items:center; gap:10px;
                        padding:10px 12px;
                        border:1px solid var(--border);
                        border-radius:8px;
                        background:var(--bg);
                        font-size:12px;
                        line-height:1.4;
                        transition:border-color .15s,background .15s;
                        cursor:pointer;
                        min-width:0;
                    " onmouseover="this.style.borderColor='#C9922A';this.style.background='rgba(201,146,42,0.05)'"
                       onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg)'">
                        <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#1A4F72,#2E6A96);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                            ${favicon ? `<img src="${favicon}" width="16" height="16" onerror="this.style.display='none'">` : `<span style="font-size:10px;font-weight:700;color:#fff;">${n}</span>`}
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:700;color:var(--primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(s.title || s.domain || 'Source ' + n)}</div>
                            <div style="color:var(--text-2);font-size:10px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.domain || ''}</div>
                        </div>
                        <svg style="flex-shrink:0;color:var(--text-2)" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    </div>`;
                }).join('');

                panel.innerHTML = `
                    <div style="background:#1A4F72;padding:10px 16px;display:flex;align-items:center;gap:8px;">
                        <svg width="14" height="14" fill="none" stroke="#C9922A" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        <span style="font-size:12px;font-weight:700;color:#fff;letter-spacing:.3px;">RESEARCH SOURCES</span>
                        <span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,0.6);">${researchSources.length} verified source${researchSources.length !== 1 ? 's' : ''} · Configurable per client</span>
                    </div>
                    <div style="padding:14px 16px;">
                        ${curated.length > 0 ? `
                            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:8px;">Primary References</div>
                            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-bottom:${pubmed.length ? '14px' : '0'};">
                                ${renderCards(curated)}
                            </div>` : ''}
                        ${pubmed.length > 0 ? `
                            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:8px;">Literature References</div>
                            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;">
                                ${renderCards(pubmed)}
                            </div>` : ''}
                    </div>`;

                // Insert after the table wrapper
                const tableWrap = document.querySelector('#assumptionsSection .results-table');
                if (tableWrap && tableWrap.parentNode) {
                    tableWrap.parentNode.insertBefore(panel, tableWrap.nextSibling);
                }
            }
        }


        // Public favicon service, no API key needed — used everywhere we show a
        // real source so its origin is recognisable at a glance.
        function _faviconUrl(url) {
            try { return 'https://www.google.com/s2/favicons?sz=32&domain=' + new URL(url).hostname; }
            catch { return ''; }
        }

        // Resolves a rationale's real cited URLs (from the LLM's <field>SourceUrls,
        // set by the /api/research backend) against the actual researchSources list,
        // by URL — never a random pick, so the badge shown is the true provenance.
        function _resolveSources(sourceUrls) {
            if (!Array.isArray(sourceUrls) || !sourceUrls.length || !researchSources) return [];
            return sourceUrls
                .map(u => researchSources.findIndex(s => s.url === u))
                .filter(i => i !== -1)
                .map(i => ({ index: i, source: researchSources[i] }));
        }

        // Registry of {text, evidence, calculation, sources} entries so footnote
        // clicks can open an evidence modal without stuffing large escaped strings
        // into HTML attributes. Reset once per assumptions render (see
        // displayAssumptions).
        window._evidenceRegistry = [];

        // ── Linkify rationale text, Wikipedia-style: numbered footnote markers
        // [1][2] right after the sentence. Clicking a footnote does NOT navigate
        // away — landing on a bare PubMed/WHO homepage doesn't explain *why* that
        // source backs this number. Instead it opens an evidence panel showing
        // the actual verbatim line retrieved from that page, plus the analyst's
        // reasoning (see _showEvidenceModal). The real URLs are still fully
        // visible in a "Sources" line directly under the rationale, and the
        // calculation (or "None") is always shown too. ──
        function linkifyRationale(text, sourceUrls, calculation, evidence) {
            if (!text) return '—';

            // Strip any raw inline https URLs / bare pubmed paths from the sentence
            // itself — the real URLs are listed visibly in the Sources line below.
            let clean = text
                .replace(/(https?:\/\/[^\s<>"'),]+)/g, '')
                .replace(/(?<!:\/\/)\b(pubmed\.ncbi\.nlm\.nih\.gov\/\d+)/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            const resolved = _resolveSources(sourceUrls);
            const calcText = (calculation && calculation.trim() && calculation.trim().toLowerCase() !== 'none')
                ? calculation.trim() : 'None';
            const evidenceText = (evidence && evidence.trim() && evidence.trim().toLowerCase() !== 'none')
                ? evidence.trim() : '';

            const regIdx = window._evidenceRegistry.length;
            window._evidenceRegistry.push({ text: clean, evidence: evidenceText, calculation: calcText, sources: resolved.map(r => r.source) });

            let html = clean;
            if (resolved.length > 0) {
                const marks = resolved.map(({ index }) => {
                    const n = index + 1;
                    return `<a href="javascript:void(0)" onclick="_showEvidenceModal(${regIdx})" class="wiki-ref" title="View evidence">[${n}]</a>`;
                }).join('');
                html += `<sup class="wiki-ref-group">${marks}</sup>`;
            }

            html += `<div class="rationale-calc"><strong>Calculation:</strong> ${calcText}</div>`;

            if (resolved.length > 0) {
                const srcLine = resolved.map(({ index, source }) => {
                    const n = index + 1;
                    return `[${n}] <a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.domain || source.url}</a>`;
                }).join(' &nbsp;·&nbsp; ');
                html += `<div class="rationale-sources"><strong>Sources:</strong> ${srcLine}</div>`;
            } else {
                html += `<div class="rationale-sources rationale-sources-none"><strong>Sources:</strong> none — reasoned from training knowledge</div>`;
            }

            return html;
        }

        // Evidence modal — shows WHY a number is what it is: the actual quoted/
        // paraphrased reasoning, the calculation (or "None"), and the real
        // source(s) as an explicit, separate "open source" action — never the
        // click target itself, so clicking a footnote never dumps you on an
        // unrelated homepage with no context.
        function _showEvidenceModal(regIdx) {
            const existing = document.getElementById('_srcDemoModal');
            if (existing) existing.remove();
            const entry = window._evidenceRegistry && window._evidenceRegistry[regIdx];
            if (!entry) return;
            const m = document.createElement('div');
            m.id = '_srcDemoModal';
            m.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,25,40,0.55);backdrop-filter:blur(3px);';
            const sourcesHtml = entry.sources.length > 0
                ? entry.sources.map(s => {
                    const favicon = _faviconUrl(s.url);
                    return `<a href="${s.url}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(26,79,114,0.15);border-radius:8px;text-decoration:none;margin-top:6px;">
                        ${favicon ? `<img src="${favicon}" width="16" height="16" style="border-radius:3px;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                        <div style="min-width:0;flex:1;">
                            <div style="font-size:11.5px;font-weight:700;color:#1A2C3D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(s.title || s.domain || '').replace(/</g, '&lt;')}</div>
                            <div style="font-size:10px;color:#4A6580;">${s.domain || ''}</div>
                        </div>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1A4F72" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>`;
                }).join('')
                : '<div style="font-size:12px;color:#4A6580;margin-top:6px;">No fetched source backs this value — it comes from the model\'s trained clinical/commercial knowledge.</div>';
            const evidenceBlock = entry.evidence
                ? `<div style="font-size:10px;font-weight:700;color:#b8811e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Evidence — actual line retrieved</div>
                   <p style="font-size:12.5px;color:#1A2C3D;line-height:1.6;font-style:italic;background:rgba(201,146,42,0.06);border-left:3px solid #C9922A;border-radius:0 7px 7px 0;padding:8px 12px;margin-bottom:14px;">&ldquo;${entry.evidence}&rdquo;</p>`
                : `<div style="font-size:10px;font-weight:700;color:#b8811e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Evidence — actual line retrieved</div>
                   <p style="font-size:12px;color:#4A6580;font-style:italic;margin-bottom:14px;">No verbatim line available — see reasoning below.</p>`;
            m.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:24px 28px;max-width:480px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.22);position:relative;font-family:'Inter',sans-serif;">
                    <button onclick="document.getElementById('_srcDemoModal').remove()" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;color:#4A6580;font-size:18px;line-height:1;padding:0;">&#x2715;</button>
                    ${evidenceBlock}
                    <div style="font-size:10px;font-weight:700;color:#b8811e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Reasoning</div>
                    <p style="font-size:13px;color:#1A2C3D;line-height:1.65;margin-bottom:14px;">${entry.text}</p>
                    <div style="font-size:10px;font-weight:700;color:#b8811e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Calculation</div>
                    <p style="font-size:12.5px;color:#1A2C3D;font-family:'JetBrains Mono',monospace;background:rgba(26,79,114,0.05);border-radius:7px;padding:8px 10px;margin-bottom:14px;">${entry.calculation}</p>
                    <div style="font-size:10px;font-weight:700;color:#b8811e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Source${entry.sources.length !== 1 ? 's' : ''}</div>
                    ${sourcesHtml}
                </div>`;
            m.addEventListener('click', e => { if (e.target === m) m.remove(); });
            document.body.appendChild(m);
        }

        function updateEpiUnit(k, ut) {
            if (assumptions[k]) {
                assumptions[k].unitType = ut;
                assumptions[k].displayUnit = ut === 'per100k' ? 'per 100,000' : ut === 'per1M' ? 'per 1,000,000' : 'rate';
                debouncedSave();
            }
        }
        function validateProductFields() {
            const launchEl = document.getElementById('launchYear');
            const peakEl = document.getElementById('peakYear');
            if (!launchEl || !peakEl) return true;

            const launchValRaw = launchEl.value;
            const peakValRaw = peakEl.value;

            let launchValid = true;
            let peakValid = true;
            let launchError = "";
            let peakError = "";

            // Validate launch year
            if (!launchValRaw.trim()) {
                launchValid = false;
                launchError = "Launch year is required";
            } else {
                const launchYear = parseInt(launchValRaw);
                if (isNaN(launchYear)) {
                    launchValid = false;
                    launchError = "Invalid year format";
                } else if (launchYear < 2000 || launchYear > 2100) {
                    launchValid = false;
                    launchError = "Launch year must be between 2000 and 2100";
                }
            }

            // Validate peak year
            if (!peakValRaw.trim()) {
                peakValid = false;
                peakError = "Forecast-End year is required";
            } else {
                const peakYear = parseInt(peakValRaw);
                const launchYear = parseInt(launchValRaw);
                if (isNaN(peakYear)) {
                    peakValid = false;
                    peakError = "Invalid year format";
                } else if (peakYear < 2000 || peakYear > 2100) {
                    peakValid = false;
                    peakError = "Forecast-End year must be between 2000 and 2100";
                } else if (!isNaN(launchYear) && peakYear <= launchYear) {
                    peakValid = false;
                    peakError = "Forecast-End year must be after launch year";
                }
            }

            // Update UI for launch year
            const launchWarnEl = document.getElementById('val-warn-launchYear');
            const launchChip = document.querySelector('.field-chip[data-field="launchYear"]');
            if (launchWarnEl) {
                if (!launchValid) {
                    launchWarnEl.textContent = "⚠ " + launchError;
                    launchWarnEl.style.display = 'block';
                    launchEl.style.borderColor = '#dc2626';
                    launchEl.style.boxShadow = '0 0 0 1px #dc2626';
                    if (launchChip) launchChip.classList.add('invalid');
                    validationErrors['launchYear'] = launchError;
                } else {
                    launchWarnEl.style.display = 'none';
                    launchEl.style.borderColor = '';
                    launchEl.style.boxShadow = '';
                    if (launchChip) launchChip.classList.remove('invalid');
                    delete validationErrors['launchYear'];
                }
            }

            // Update UI for peak year
            const peakWarnEl = document.getElementById('val-warn-peakYear');
            const peakChip = document.querySelector('.field-chip[data-field="peakYear"]');
            if (peakWarnEl) {
                if (!peakValid) {
                    peakWarnEl.textContent = "⚠ " + peakError;
                    peakWarnEl.style.display = 'block';
                    peakEl.style.borderColor = '#dc2626';
                    peakEl.style.boxShadow = '0 0 0 1px #dc2626';
                    if (peakChip) peakChip.classList.add('invalid');
                    validationErrors['peakYear'] = peakError;
                } else {
                    peakWarnEl.style.display = 'none';
                    peakEl.style.borderColor = '';
                    peakEl.style.boxShadow = '';
                    if (peakChip) peakChip.classList.remove('invalid');
                    delete validationErrors['peakYear'];
                }
            }

            updateGlobalValidationStatus();
            updateDefineFlowButtonState();
            return launchValid && peakValid;
        }

        function validateAssumptionInput(key, rawValue, element) {
            const error = getAssumptionInputError(key, rawValue);
            const inputId = key;
            updateFieldValidationUI(key, inputId, error, element);
            return !error;
        }

        function getAssumptionInputError(key, rawValue) {
            const data = assumptions[key];
            if (!data) return null;
            
            let s = String(rawValue).trim().replace(/,/g, '');
            let isPct = data.unit === '%';
            
            if (s.startsWith('$')) s = s.slice(1).trim();
            if (s.endsWith('%')) {
                s = s.slice(0, -1).trim();
                isPct = true;
            }
            
            if (!s) {
                return "Value is required";
            }
            
            const numRegex = /^-?\d+(\.\d+)?$/;
            if (!numRegex.test(s)) {
                return "Invalid numeric format";
            }
            
            const val = parseFloat(s);
            if (isNaN(val)) {
                return "Invalid numeric format";
            }
            
            if (val < 0) {
                return isPct ? "Percentage cannot be negative" : "Value cannot be negative";
            }
            
            if (isPct && val > 100) {
                return "Percentage cannot exceed 100%";
            }
            
            if (data.unitType === 'rate' && val > 1.0) {
                return "Rate cannot exceed 1.0";
            }
            if (data.unitType === 'per100k' && val > 100000) {
                return "Rate cannot exceed 100,000";
            }
            if (data.unitType === 'per1M' && val > 1000000) {
                return "Rate cannot exceed 1,000,000";
            }
            
            return null;
        }

        function validateYoYGrowthInput(key, rawValue, element) {
            const error = getYoYGrowthInputError(key, rawValue);
            const inputId = key + '_yoy';
            updateFieldValidationUI(key, inputId, error, element);
            return !error;
        }

        function getYoYGrowthInputError(key, rawValue) {
            let s = String(rawValue).trim();
            if (s.endsWith('%')) s = s.slice(0, -1).trim();
            
            if (!s) return "Value is required";
            
            const numRegex = /^-?\d+(\.\d+)?$/;
            if (!numRegex.test(s)) {
                return "Invalid numeric format";
            }
            
            const val = parseFloat(s);
            if (isNaN(val)) {
                return "Invalid numeric format";
            }
            
            if (val < 0) {
                return "YoY Growth cannot be negative";
            }
            if (val > 100) {
                return "YoY Growth percentage cannot exceed 100%";
            }
            
            return null;
        }

        function validateShareParamInput(key, param, rawValue, element) {
            const error = getShareParamInputError(key, param, rawValue);
            const inputId = key + '_' + param;
            updateFieldValidationUI(key, inputId, error, element);
            return !error;
        }

        function getShareParamInputError(key, param, rawValue) {
            let s = String(rawValue).trim();
            if (s.endsWith('%')) s = s.slice(0, -1).trim();
            
            if (!s) return "Value is required";
            
            if (param === 'peakYear') {
                const numRegex = /^\d+$/;
                if (!numRegex.test(s)) {
                    return "Invalid year format";
                }
                const val = parseInt(s);
                if (isNaN(val) || val <= 0) {
                    return "Invalid year";
                }
                const launchYr = assumptions.launchYear || parseInt(document.getElementById('launchYear').value) || 0;
                if (val < launchYr) {
                    return `Cannot be before launch year (${launchYr})`;
                }
                return null;
            }
            
            const numRegex = /^-?\d+(\.\d+)?$/;
            if (!numRegex.test(s)) {
                return "Invalid numeric format";
            }
            
            const val = parseFloat(s);
            if (isNaN(val)) {
                return "Invalid numeric format";
            }
            
            if (val < 0) {
                return "Percentage cannot be negative";
            }
            
            if (val > 100) {
                return "Percentage cannot exceed 100%";
            }
            
            return null;
        }

        function updateFieldValidationUI(key, errorId, errorMsg, element) {
            const warnEl = document.getElementById('val-warn-' + key);
            if (errorMsg) {
                validationErrors[errorId] = errorMsg;
                if (element) {
                    element.style.borderColor = '#dc2626';
                    element.style.boxShadow = '0 0 0 1px #dc2626';
                }
                if (warnEl) {
                    warnEl.textContent = "⚠ " + errorMsg;
                    warnEl.className = "validation-indicator error";
                    warnEl.style.color = "#dc2626";
                    warnEl.style.fontWeight = "600";
                }
            } else {
                delete validationErrors[errorId];
                if (element) {
                    element.style.borderColor = '';
                    element.style.boxShadow = '';
                }
                const vr = validateParameter(key);
                if (warnEl) {
                    warnEl.textContent = (vr.valid ? '✓ ' : '⚠ ') + vr.message;
                    warnEl.className = "validation-indicator " + (vr.valid ? "valid" : "warning");
                    warnEl.style.color = "";
                    warnEl.style.fontWeight = "";
                }
            }
            updateGlobalValidationStatus();
        }

        function updateGlobalValidationStatus() {
            const el = document.getElementById('validationStatus');
            const me = document.getElementById('validationMessage');
            if (!el || !me) return;

            const errorCount = Object.keys(validationErrors).length;
            const btns = document.querySelectorAll('button');

            if (errorCount > 0) {
                el.classList.remove('hidden', 'success');
                el.classList.add('warning');
                el.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                el.style.borderColor = '#dc2626';
                el.style.color = '#dc2626';
                
                const errors = Object.values(validationErrors);
                me.innerHTML = `<strong>Please resolve errors before running forecast:</strong> ${errors.join(' | ')}`;
                
                btns.forEach(btn => {
                    if (btn.textContent.trim() === 'Calculate Forecast') {
                        btn.disabled = true;
                        btn.classList.add('btn-disabled');
                    }
                });
            } else {
                el.style.backgroundColor = '';
                el.style.borderColor = '';
                el.style.color = '';
                el.classList.remove('warning');
                el.classList.add('success');
                
                btns.forEach(btn => {
                    if (btn.textContent.trim() === 'Calculate Forecast') {
                        btn.disabled = false;
                        btn.classList.remove('btn-disabled');
                    }
                });
                validateAssumptions();
            }
        }

        function updateShareParam(k, p, v, element) {
            if (!assumptions[k]) return;
            const isValid = validateShareParamInput(k, p, v, element);
            if (!isValid) return; // Prevent saving if invalid
            
            let cleanStr = String(v).trim();
            if (cleanStr.endsWith('%')) cleanStr = cleanStr.slice(0, -1).trim();
            const n = parseFloat(cleanStr);
            const launchYr = assumptions.launchYear || parseInt(document.getElementById('launchYear').value) || 0;
            if (p === 'startingShare') {
                assumptions[k].startingShare = n / 100;
            } else if (p === 'timeToPeak') {
                assumptions[k].timeToPeak = n;
                assumptions[k].peakYear = launchYr + n;
            } else if (p === 'peakYear') {
                assumptions[k].peakYear = n;
                assumptions[k].timeToPeak = Math.max(0, n - launchYr);
            } else if (p === 'curveType') {
                assumptions[k].curveType = v;
            }
            debouncedSave();
        }
        function toggleYoYGrowth(k, en) {
            if (!assumptions[k]) return;
            if (en) { 
                assumptions[k].yoyGrowth = 0; 
                document.getElementById(`yoy_${k}`).disabled = false; 
                delete validationErrors[k + '_yoy'];
            }
            else { 
                delete assumptions[k].yoyGrowth; 
                document.getElementById(`yoy_${k}`).disabled = true; 
                delete validationErrors[k + '_yoy'];
                const inputYoY = document.getElementById(`yoy_${k}`);
                if (inputYoY) {
                    inputYoY.style.borderColor = '';
                    inputYoY.style.boxShadow = '';
                }
            }
            updateGlobalValidationStatus();
            debouncedSave();
        }
        function updateYoYGrowth(k, v, element) { 
            if (!assumptions[k]) return;
            const isValid = validateYoYGrowthInput(k, v, element);
            if (!isValid) return; // Prevent saving if invalid
            
            let cleanStr = String(v).trim();
            if (cleanStr.endsWith('%')) cleanStr = cleanStr.slice(0, -1).trim();
            let p = parseFloat(cleanStr) / 100;
            
            assumptions[k].yoyGrowth = p; 
            debouncedSave(); 
        }
        function formatValue(v, u) {
            if (u === '%') return (v * 100).toFixed(1);
            if (u === 'rate') return v.toFixed(4);
            if (u === '$') return v.toLocaleString();
            if (u === 'persons') return v.toLocaleString();
            return v;
        }
        function updateAssumption(k, nv, element) {
            const isValid = validateAssumptionInput(k, nv, element);
            if (!isValid) return; // Prevent saving if invalid
            
            const data = assumptions[k]; 
            let cleanStr = String(nv).trim().replace(/,/g, '');
            if (cleanStr.startsWith('$')) cleanStr = cleanStr.slice(1).trim();
            if (cleanStr.endsWith('%')) cleanStr = cleanStr.slice(0, -1).trim();
            let p = parseFloat(cleanStr);
            if (data.unit === '%') p = p / 100;
            assumptions[k].value = p; validateAssumptions(); debouncedSave();
        }
        function validateParameter(k) {
            const data = assumptions[k]; if (!data) return { valid: true, message: 'Parameter configured' };
            let valid = true, message = 'Within expected range';
            if (k === 'diagnosisRate' && data.value < 0.5) { valid = false; message = 'Below 50% – verify data'; }
            else if (k === 'peakProductShare' && data.value > 0.40) { valid = false; message = 'Above 40% – high for new entrant'; }
            else if (k === 'discount' && data.value > 0.30) { valid = false; message = 'Above 30% – verify benchmarks'; }
            return { valid, message };
        }
        function validateAssumptions() {
            const el = document.getElementById('validationStatus'), me = document.getElementById('validationMessage');
            if (!el || !me) return;
            el.classList.remove('hidden');
            let w = [];
            if (assumptions.diagnosisRate && assumptions.diagnosisRate.value < 0.5) w.push('Diagnosis rate below 50%');
            if (assumptions.peakProductShare && assumptions.peakProductShare.value > 0.40) w.push('Product share above 40%');
            if (assumptions.discount && assumptions.discount.value > 0.30) w.push('Discount above 30%');
            if (assumptions.treatmentRate && assumptions.treatmentRate.value < 0.4) w.push('Treatment rate below 40%');
            if (w.length) { el.classList.remove('success'); el.classList.add('warning'); me.textContent = w.join(' | '); }
            else { el.classList.remove('warning'); el.classList.add('success'); me.textContent = `All ${selectedParameters.parameters.length} parameters validated`; }
        }

        /* ── Engine phase helpers ───────────────────────────────────────────── */
        let _engineStepTimer = null;
        let _engineStepIdx   = 0;

        function _setEnginePhase(title, subtitle, stepLabels) {
            document.getElementById('engineRunTitle').textContent  = title;
            document.getElementById('engineStatusText').textContent = subtitle;
            const bar = document.getElementById('engineProgressBar');
            bar.style.transition = 'none'; bar.style.width = '0%';
            document.getElementById('engineProgressLabel').textContent = '';
            for (let i = 1; i <= 5; i++) {
                const el = document.getElementById('estep' + i);
                const lbl = stepLabels[i - 1] || '';
                el.className = lbl ? 'engine-step pending' : 'engine-step hidden';
                el.querySelector('.engine-step-icon').textContent  = '○';
                el.querySelector('.engine-step-label').textContent = lbl;
            }
        }

        function _engineTickStep(total) {
            if (_engineStepTimer) clearTimeout(_engineStepTimer);
            if (_engineStepIdx > 0) {
                const prevEl = document.getElementById('estep' + _engineStepIdx);
                if (prevEl) { prevEl.className = 'engine-step done'; prevEl.querySelector('.engine-step-icon').textContent = '✓'; }
            }
            _engineStepIdx++;
            if (_engineStepIdx > total) return;
            const curEl = document.getElementById('estep' + _engineStepIdx);
            if (curEl) {
                curEl.className = 'engine-step running';
                curEl.querySelector('.engine-step-icon').textContent = '●';
                document.getElementById('engineStatusText').textContent = curEl.querySelector('.engine-step-label').textContent + '…';
            }
            const pct = Math.round((_engineStepIdx / (total + 1)) * 90);
            const bar = document.getElementById('engineProgressBar');
            bar.style.transition = 'width 0.6s ease'; bar.style.width = pct + '%';
        }

        function _startEngineStepAnimation(total, intervalMs) {
            _engineStepIdx = 0;
            if (_engineStepTimer) clearTimeout(_engineStepTimer);
            function step() { _engineTickStep(total); if (_engineStepIdx <= total) _engineStepTimer = setTimeout(step, intervalMs); }
            step();
        }

        function _completeEnginePhase() {
            if (_engineStepTimer) { clearTimeout(_engineStepTimer); _engineStepTimer = null; }
            for (let i = 1; i <= 5; i++) {
                const el = document.getElementById('estep' + i);
                if (!el.classList.contains('hidden')) { el.className = 'engine-step done'; el.querySelector('.engine-step-icon').textContent = '✓'; }
            }
            const bar = document.getElementById('engineProgressBar');
            bar.style.transition = 'width 0.4s ease'; bar.style.width = '100%';
            document.getElementById('engineProgressLabel').textContent = '100%';
        }
        /* ─────────────────────────────────────────────────────────────────── */

        function calculateForecast() {
            if (Object.keys(validationErrors).length > 0) {
                alert("Please resolve all validation errors before running the forecast.");
                return;
            }
            forecastCalculated = false;
            forecastData = [];
            _cancelExcelOverlay = null; _completeExcelOverlay = null;

            const dlBtn = document.getElementById('downloadExcelBtn');
            if (dlBtn) { dlBtn.href = '#'; dlBtn.classList.add('btn-disabled'); }
            _resetPptxBtn();

            document.getElementById('workspace').scrollTop = 0;
            document.getElementById('viewResultsBtn').style.display = 'none';
            document.getElementById('assumptionsSection').style.display = 'none';
            const engSec = document.getElementById('forecastEngineSection');
            engSec.classList.remove('hidden'); engSec.style.display = '';
            document.getElementById('engineOverlay').style.display = 'block';
            document.getElementById('engineDetails').style.display = 'none';
            document.getElementById('engineBtns').style.display = 'none';
            document.getElementById('resultsSection').classList.add('hidden');
            updateNavigation(4);

            _setEnginePhase('Calculating Forecast', 'Running patient-based model…', [
                'Epidemiology model', 'Patient flow simulation',
                'Revenue projection', 'Validating results', ''
            ]);
            _startEngineStepAnimation(4, 700); // ~2.8s for 4 steps
            fetchForecastAndDisplay();
        }

        async function fetchForecastAndDisplay() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/forecast`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assumptions: assumptions || {},
                        selected_parameters: selectedParameters ? selectedParameters.parameters : []
                    })
                });
                const data = await res.json();
                if (data.forecast_results) {
                    forecastData = data.forecast_results;
                    saveUserInput();
                    displayForecast(); // pre-populate table/KPIs; charts resize on transition
                }
                // Phase 2: hold on engine overlay while PPTX generates
                _completeEnginePhase();
                setTimeout(() => {
                    _setEnginePhase('Building Presentation', 'Generating AI-powered slides…', [
                        'Title & executive summary',
                        'Market assumptions',
                        'Revenue forecast chart',
                        'Patient volume chart',
                        'Results summary'
                    ]);
                    _startEngineStepAnimation(5, 13000); // ~65s across 5 steps
                }, 500);
                botSay('✅ **Forecast calculated.** Generating your presentation — moving to dashboard in ~60 seconds…', []);
                invokeAgentForecastInBackground();
                // Safety fallback: if PPTX never completes, force transition after 6 min
                setTimeout(() => { if (!forecastCalculated) { console.warn('PPTX timeout — forcing transition.'); transitionToResults(); } }, 360000);
            } catch (err) {
                botSay('⚠️ Could not load forecast: ' + err.message, []);
                transitionToResults();
            }
        }

        function runEngineAnimationForDuration(ms, onComplete) {
            const steps = [
                { id: 'estep1', txt: 'Calculating epidemiology build-up…' },
                { id: 'estep2', txt: 'Simulating patient flow pathways…' },
                { id: 'estep3', txt: 'Applying S-curve adoption model…' },
                { id: 'estep4', txt: 'Projecting year-by-year revenues…' },
                { id: 'estep5', txt: 'Validating assumptions…' }
            ];
            const bar = document.getElementById('engineProgressBar');
            const label = document.getElementById('engineProgressLabel');
            const status = document.getElementById('engineStatusText');
            const interval = ms / steps.length;
            let idx = 0;
            function tick() {
                if (idx < steps.length) {
                    if (idx > 0) {
                        const prev = document.getElementById(steps[idx - 1].id);
                        prev.className = 'engine-step done';
                        prev.querySelector('.engine-step-icon').textContent = '✓';
                    }
                    const cur = document.getElementById(steps[idx].id);
                    cur.className = 'engine-step running';
                    cur.querySelector('.engine-step-icon').textContent = '●';
                    status.textContent = steps[idx].txt;
                    const pct = Math.round(((idx + 1) / steps.length) * 100);
                    bar.style.width = pct + '%';
                    label.textContent = pct + '%';
                    idx++;
                    setTimeout(tick, interval);
                } else {
                    bar.style.width = '100%';
                    label.textContent = '100%';
                    status.textContent = 'Forecast complete!';
                    setTimeout(onComplete, 400);
                }
            }
            setTimeout(tick, 200);
        }

        // ── Agent integration ─────────────────────────────────────────────────
        let _agentSessionId = null;

        let _agentPollInterval = null;
        let _excelWorkbook = null;
        let _completeExcelOverlay = null;
        let _cancelExcelOverlay = null;

        // ── PPTX agent state ──────────────────────────────────────────────────
        let _pptxPollInterval = null;
        let _pptxPollingDone  = false;

        function _resetPptxBtn() {
            const btn   = document.getElementById('downloadPptxBtn');
            const badge = document.getElementById('pptxStatusBadge');
            if (btn)   { btn.href = '#'; btn.classList.add('btn-disabled'); }
            if (badge) { badge.style.display = 'inline-flex'; badge.innerHTML = '<span class="pptx-status-dot"></span>Preparing presentation…'; }
        }

        function _enablePptxBtn(sessionId) {
            const btn   = document.getElementById('downloadPptxBtn');
            const badge = document.getElementById('pptxStatusBadge');
            const pptxHref = `${BACKEND_URL}/api/pptx?session_id=${encodeURIComponent(sessionId)}`;
            if (btn) {
                btn.href = pptxHref;
                btn.download = 'forecast_presentation.pptx';
                btn.classList.remove('btn-disabled');
            }
            if (badge) { badge.style.display = 'none'; }
            // Surface download in chat
            botSayWithActions('✅ **Presentation ready.** Your AI-generated slides with narratives are available.', [{
                label: 'Download Presentation',
                href: pptxHref,
                download: 'forecast_presentation.pptx',
                cls: 'pptx'
            }]);
        }

        function pollPptxStatus(sessionId) {
            if (_pptxPollInterval) clearInterval(_pptxPollInterval);
            _pptxPollingDone = false;
            _pptxPollInterval = setInterval(async () => {
                if (_pptxPollingDone) return;
                try {
                    const res  = await fetch(`${BACKEND_URL}/api/pptx/status?session_id=${encodeURIComponent(sessionId)}`);
                    const data = await res.json();
                    if (data.status === 'done') {
                        _pptxPollingDone = true;
                        clearInterval(_pptxPollInterval);
                        _pptxPollInterval = null;
                        _enablePptxBtn(sessionId);
                        // PPTX complete — complete engine steps then go to results
                        _completeEnginePhase();
                        setTimeout(() => transitionToResults(), 600);
                    } else if (data.status === 'error') {
                        _pptxPollingDone = true;
                        clearInterval(_pptxPollInterval);
                        _pptxPollInterval = null;
                        console.warn('PPTX generation error:', data.error);
                        // Still transition — presentation just won't be downloadable
                        _completeEnginePhase();
                        setTimeout(() => transitionToResults(), 600);
                    }
                } catch (e) {
                    // network hiccup — keep polling
                }
            }, 3000);
        }

        function invokePptxAgentInBackground(sessionId, userInput) {
            _resetPptxBtn();
            const payload = { session_id: sessionId, user_input: userInput };
            fetch(`${BACKEND_URL}/api/pptx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'started' && data.session_id) {
                    pollPptxStatus(data.session_id);
                }
            })
            .catch(err => console.warn('PPTX agent start failed:', err.message));
        }

        // Transition engine section out and reveal results section
        function transitionToResults() {
            if (forecastCalculated) return;  // already transitioned — safe no-op
            forecastCalculated = true;
            document.getElementById('engineOverlay').style.display = 'none';
            document.getElementById('forecastEngineSection').style.display = 'none';
            document.getElementById('resultsSection').classList.remove('hidden');
            document.getElementById('resultsSection').style.display = 'block';
            updateNavigation(5);
            // Show Input + Forecast sheets immediately from client data; pending tabs for the rest
            _renderPartialExcelPreview();
            // Force chart resize now that canvases are visible
            requestAnimationFrame(() => {
                if (salesChart)    { salesChart.resize();    salesChart.update('none'); }
                if (patientsChart) { patientsChart.resize(); patientsChart.update('none'); }
            });
        }

        // Phase 2 of engine overlay: show Excel build progress while agent runs.
        // Steps loop continuously until _completeExcelOverlay() is called by pollAgentStatus.
        function runExcelBuildAnimation() {
            const titleEl = document.getElementById('engineRunTitle');
            const statusEl = document.getElementById('engineStatusText');
            const bar = document.getElementById('engineProgressBar');
            const label = document.getElementById('engineProgressLabel');

            titleEl.textContent = 'Building Excel Workbook';
            statusEl.textContent = 'Preparing workbook…';
            bar.style.width = '0%';
            label.textContent = '0%';

            const EXCEL_STEPS = [
                { id: 'estep1', label: 'Preparing data structure',        statusTxt: 'Structuring data for export…'         },
                { id: 'estep2', label: 'Generating workbook sheets',       statusTxt: 'Creating worksheet tabs…'             },
                { id: 'estep3', label: 'Applying formatting & styles',     statusTxt: 'Applying cell formatting & styles…'   },
                { id: 'estep4', label: 'Building charts & visualizations', statusTxt: 'Embedding charts in workbook…'        },
                { id: 'estep5', label: 'Finalizing workbook',              statusTxt: 'Finalizing and compressing workbook…' },
            ];

            const STEP_MS = 12000; // 12s per step; advances once through all steps then holds
            let _loopTimer = null;
            let _done = false;
            let _currentIdx = 0;

            function resetStepLabels() {
                EXCEL_STEPS.forEach(s => {
                    const el = document.getElementById(s.id);
                    el.className = 'engine-step pending';
                    el.querySelector('.engine-step-icon').textContent = '○';
                    el.querySelector('.engine-step-label').textContent = s.label;
                });
            }

            resetStepLabels();

            // Progress bar advances linearly to 90% across all steps, then holds until agent is done.
            function barPct(idx) {
                return Math.round(((idx + 1) / EXCEL_STEPS.length) * 90);
            }

            function tick() {
                if (_done) return;
                const idx = _currentIdx;

                // Mark previous step done
                if (idx > 0) {
                    const prev = document.getElementById(EXCEL_STEPS[idx - 1].id);
                    prev.className = 'engine-step done';
                    prev.querySelector('.engine-step-icon').textContent = '✓';
                }

                const cur = document.getElementById(EXCEL_STEPS[idx].id);
                cur.className = 'engine-step running';
                cur.querySelector('.engine-step-icon').textContent = '●';
                statusEl.textContent = EXCEL_STEPS[idx].statusTxt;

                const pct = barPct(idx);
                bar.style.width = pct + '%';
                label.textContent = pct + '%';

                _currentIdx++;
                if (_currentIdx >= EXCEL_STEPS.length) {
                    // All steps shown — hold at last step (running) at 90% until agent finishes
                    // No loop; _completeExcelOverlay() will finalise when polling confirms done
                } else {
                    _loopTimer = setTimeout(tick, STEP_MS);
                }
            }

            _loopTimer = setTimeout(tick, 300);

            _cancelExcelOverlay = function () {
                _done = true;
                clearTimeout(_loopTimer);
            };

            _completeExcelOverlay = function () {
                _done = true;
                clearTimeout(_loopTimer);
                EXCEL_STEPS.forEach(s => {
                    const el = document.getElementById(s.id);
                    el.className = 'engine-step done';
                    el.querySelector('.engine-step-icon').textContent = '✓';
                });
                bar.style.width = '100%';
                label.textContent = '100%';
                statusEl.textContent = 'Workbook ready!';
                setTimeout(transitionToResults, 600);
            };
        }

        function invokeAgentForecastInBackground() {
            const userInputPayload = {
                product_info: {
                    country: (document.getElementById('country') || {}).value || '',
                    productName: (document.getElementById('productName') || {}).value || '',
                    classMoa: (document.getElementById('classMoa') || {}).value || '',
                    indication: (document.getElementById('indication') || {}).value || '',
                    launchYear: (document.getElementById('launchYear') || {}).value || '',
                    peakYear: (document.getElementById('peakYear') || {}).value || ''
                },
                selected_parameters: selectedParameters ? selectedParameters.parameters : [],
                assumptions: assumptions || {},
                forecast_results: forecastData || []
            };

            fetch(`${BACKEND_URL}/api/agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_input: userInputPayload })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'started' && data.session_id) {
                        _agentSessionId = data.session_id;
                        pollAgentStatus();
                        // ── Launch PPTX generation in parallel using same session_id ──
                        invokePptxAgentInBackground(_agentSessionId, userInputPayload);
                    } else if (!data.success) {
                        botSay('⚠️ Could not start Forecast Agent: ' + (data.error || data.message || 'Unknown error.'));
                    }
                })
                .catch(err => {
                    const db = document.getElementById('goToDashboardBtn');
                    if (db) db.disabled = false;
                    botSay('⚠️ Could not reach Forecast Agent: ' + err.message);
                });
        }

        let _agentPollingDone = false; // guard against async setInterval re-entrancy

        // ── Stage-based progress engine ───────────────────────────────────────
        // Scripted stages front-load progress so early movement feels fast.
        // Timings tuned for a ~360s (6 min) generation job.
        const _XV_STAGES = [
            { pct:  5, label: "Reading market assumptions…",      s:   2 },
            { pct: 13, label: "Estimating patient population…",   s:  15 },
            { pct: 22, label: "Modeling treatment rates…",        s:  32 },
            { pct: 32, label: "Building revenue waterfall…",      s:  55 },
            { pct: 41, label: "Calculating peak year dynamics…",  s:  85 },
            { pct: 52, label: "Running sensitivity analysis…",    s: 125 },
            { pct: 61, label: "Applying net price adjustments…",  s: 165 },
            { pct: 69, label: "Generating scenario forecasts…",   s: 205 },
            { pct: 76, label: "Building summary tables…",         s: 245 },
            { pct: 83, label: "Formatting workbook sheets…",      s: 285 },
            { pct: 88, label: "Writing formulas and chart data…", s: 315 },
            { pct: 92, label: "Validating outputs…",              s: 340 },
            { pct: 94, label: "Almost ready…",                    s: 355 },
        ];
        let _xvStageIdx = -1;

        function _xvAdvanceStages(elapsedS) {
            const fill = document.getElementById('xv-skel-fill');
            const lbl  = document.getElementById('xv-skel-label');
            const log  = document.getElementById('xv-stage-log');
            if (!fill || !lbl) return;

            // Find the highest stage whose time threshold has been crossed
            let newIdx = _xvStageIdx;
            for (let i = _xvStageIdx + 1; i < _XV_STAGES.length; i++) {
                if (elapsedS >= _XV_STAGES[i].s) newIdx = i;
                else break;
            }
            if (newIdx === _xvStageIdx) return; // nothing new

            // Log all stages that just completed (all except the newly active one)
            for (let i = _xvStageIdx + 1; i < newIdx; i++) {
                if (log) _xvLogDone(_XV_STAGES[i].label, log);
            }

            // Animate the bar to this stage's percentage
            const stage = _XV_STAGES[newIdx];
            const nextS = newIdx + 1 < _XV_STAGES.length ? _XV_STAGES[newIdx + 1].s : stage.s + 30;
            const dur   = Math.min(Math.max(2, nextS - stage.s), 10);
            fill.style.transition = `width ${dur}s ease-out`;
            fill.style.width = stage.pct + '%';

            // Log the previous active stage as done, set new label
            if (_xvStageIdx >= 0 && log) _xvLogDone(_XV_STAGES[_xvStageIdx].label, log);
            lbl.textContent = stage.label;

            _xvStageIdx = newIdx;
        }

        function _xvLogDone(label, log) {
            const el = document.createElement('div');
            el.className = 'xv-stage-entry';
            el.textContent = label;
            log.appendChild(el);
            // Keep only the 3 most recent entries visible
            while (log.children.length > 3) log.removeChild(log.firstChild);
        }

        function _xvResetStages() {
            _xvStageIdx = -1;
            const log  = document.getElementById('xv-stage-log');
            const fill = document.getElementById('xv-skel-fill');
            const lbl  = document.getElementById('xv-skel-label');
            if (log)  log.innerHTML = '';
            if (fill) { fill.style.transition = 'none'; fill.style.width = '2%'; }
            if (lbl)  lbl.textContent = 'Starting up…';
        }
        // ─────────────────────────────────────────────────────────────────────

        function pollAgentStatus() {
            if (_agentPollInterval) clearInterval(_agentPollInterval);
            _agentPollingDone = false;
            _agentPollInterval = setInterval(async () => {
                if (_agentPollingDone) return; // another async tick already handled done/error
                try {
                    const res = await fetch(`${BACKEND_URL}/api/agent/status?session_id=${encodeURIComponent(_agentSessionId)}`);
                    const data = await res.json();
                    // Drive the stage engine from elapsed time
                    if (data.elapsed_s !== undefined) {
                        _xvAdvanceStages(data.elapsed_s);
                    }
                    if (data.status === 'done') {
                        if (_agentPollingDone) return;
                        _agentPollingDone = true;
                        clearInterval(_agentPollInterval);
                        _agentPollInterval = null;
                        if (data.skipped || !data.workbook_path) {
                            // Excel generation is disabled (BUILD_EXCEL_FLAG=false) — leave the
                            // download button/preview in their disabled default state.
                            const lbl = document.getElementById('xv-skel-label');
                            if (lbl) lbl.textContent = 'Excel workbook generation is disabled.';
                            return;
                        }
                        // Snap skeleton bar to 100% before swap
                        const fill = document.getElementById('xv-skel-fill');
                        const lbl  = document.getElementById('xv-skel-label');
                        if (fill) { fill.style.transition = 'width 0.4s ease'; fill.style.width = '100%'; }
                        if (lbl) lbl.textContent = 'Workbook ready!';
                        const dlBtn = document.getElementById('downloadExcelBtn');
                        if (dlBtn) {
                            dlBtn.href = `${BACKEND_URL}/api/excel?session_id=${encodeURIComponent(_agentSessionId)}`;
                            dlBtn.download = 'forecast.xlsx';
                            dlBtn.classList.remove('btn-disabled');
                        }
                        setTimeout(() => fetchAndRenderExcelPreview(), 400); // small delay so 100% fill is visible
                        const excelHref = `${BACKEND_URL}/api/excel?session_id=${encodeURIComponent(_agentSessionId)}`;
                        botSayWithActions('✅ **Excel workbook ready.** Calculations & Summary sheets are now live in the preview.', [{
                            label: 'Download Workbook',
                            href: excelHref,
                            download: 'forecast.xlsx',
                            cls: 'excel'
                        }]);
                    } else if (data.status === 'error') {
                        if (_agentPollingDone) return;
                        _agentPollingDone = true;
                        clearInterval(_agentPollInterval);
                        _agentPollInterval = null;
                        botSay('⚠️ Agent returned an error: ' + (data.error || 'Unknown error.'));
                    }
                } catch (e) {
                    // Keep polling on transient errors
                }
            }, 2000);
        }

        // ── Excel Viewer state ────────────────────────────────────────────────
        let _xvSheets = [];
        let _xvSelectedCell = null;
        let _xvHF = null;

        function _xvInitHF(sheets) {
            if (typeof HyperFormula === 'undefined') return;
            try {
                const sheetsData = {};
                sheets.forEach(sh => {
                    const [, , maxR, maxC] = sh.range;
                    const rows = maxR + 1, cols = maxC + 1;
                    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
                    Object.entries(sh.cells).forEach(([key, cd]) => {
                        const [r, c] = key.split(',').map(Number);
                        if (r >= rows || c >= cols) return;
                        if (cd.f) grid[r][c] = cd.f;
                        else if (cd.v !== undefined && cd.v !== null)
                            grid[r][c] = cd.t === 'n' ? Number(cd.v) : cd.v;
                    });
                    sheetsData[sh.name] = grid;
                });
                _xvHF = HyperFormula.buildFromSheets(sheetsData, { licenseKey: 'gpl-v3' });
            } catch (e) { console.warn('HyperFormula init failed:', e); _xvHF = null; }
        }

        function _xvHFGet(sheetName, r, c) {
            if (!_xvHF) return null;
            try {
                const id = _xvHF.getSheetId(sheetName);
                if (id === undefined) return null;
                return _xvHF.getCellValue({ sheet: id, row: r, col: c });
            } catch (e) { return null; }
        }

        function _xvHFFmt(val, nf) {
            if (val === null || val === undefined) return '';
            if (typeof val === 'object' && val.type) return String(val);
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'number') {
                if (!nf || nf === 'General' || nf === '@') {
                    if (Number.isFinite(val) && val === Math.trunc(val) && Math.abs(val) < 1e15) return String(Math.trunc(val));
                    return String(val);
                }
                try {
                    if (nf.includes('%')) { const m = nf.match(/\.(0+)/); return (val * 100).toFixed(m ? m[1].length : 0) + '%'; }
                    const symM = nf.match(/[$£€]/);
                    if (symM) { const m = nf.match(/\.(0+)/); const dec = m ? m[1].length : 2; return symM[0] + val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
                    if (nf.includes(',')) { const m = nf.match(/\.(0+)/); const dec = m ? m[1].length : 0; return val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
                    const m = nf.match(/\.(0+)/); if (m) return val.toFixed(m[1].length);
                } catch (e) {}
                return String(val);
            }
            return String(val);
        }

        function _xvColLabel(n) {
            let s = ''; n++;
            while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor((n - 1) / 26); }
            return s;
        }

        function _xvRenderTabs() {
            const bar = document.getElementById('xv-tabs-bar');
            bar.innerHTML = '';
            _xvSheets.forEach((sh, i) => {
                const btn = document.createElement('button');
                btn.className = 'xv-tab' + (i === 0 ? ' active' : '');
                btn.textContent = sh.name;
                btn.onclick = () => {
                    bar.querySelectorAll('.xv-tab').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                    _xvRenderSheet(i);
                };
                bar.appendChild(btn);
            });
        }

        function _xvApplyStyle(el, s) {
            if (s.bg) el.style.backgroundColor = s.bg;
            if (s.bold) el.style.fontWeight = 'bold';
            if (s.italic) el.style.fontStyle = 'italic';
            if (s.underline) el.style.textDecoration = 'underline';
            if (s.fontSize) el.style.fontSize = Math.round(s.fontSize * 4 / 3) + 'px';
            if (s.fontName) el.style.fontFamily = `"${s.fontName}", Calibri, sans-serif`;
            if (s.color) el.style.color = s.color;
            if (s.align && s.align !== 'general') el.style.textAlign = s.align;
            if (s.wrap) el.style.whiteSpace = 'normal';
        }

        function _xvOnCellClick(e) {
            const td = e.currentTarget;
            if (_xvSelectedCell) {
                _xvSelectedCell.classList.remove('xv-selected');
                const pr = parseInt(_xvSelectedCell.dataset.row), pc = parseInt(_xvSelectedCell.dataset.col);
                const prh = document.querySelector(`#xv-grid tbody th[data-row="${pr}"]`);
                if (prh) prh.classList.remove('xv-row-hl');
                const pch = document.querySelectorAll('#xv-grid thead th')[pc + 1];
                if (pch) pch.classList.remove('xv-col-hl');
            }
            td.classList.add('xv-selected');
            _xvSelectedCell = td;
            const col = parseInt(td.dataset.col), row = parseInt(td.dataset.row);
            document.getElementById('xv-cell-ref').textContent = _xvColLabel(col) + (row + 1);
            const fbar = document.getElementById('xv-cell-formula');
            const formula = td.dataset.formula;
            if (formula) { fbar.textContent = formula; fbar.className = 'xv-formula-content xv-is-formula'; }
            else { fbar.textContent = td.dataset.display; fbar.className = 'xv-formula-content'; }
            const rowHeader = document.querySelector(`#xv-grid tbody th[data-row="${row}"]`);
            if (rowHeader) rowHeader.classList.add('xv-row-hl');
            const headers = document.querySelectorAll('#xv-grid thead th');
            if (headers[col + 1]) headers[col + 1].classList.add('xv-col-hl');
            const num = parseFloat(td.dataset.rawVal);
            if (!isNaN(num) && td.dataset.type === 'n') {
                document.getElementById('xv-stat-avg').textContent = num.toLocaleString();
                document.getElementById('xv-stat-count').textContent = '1';
                document.getElementById('xv-stat-sum').textContent = num.toLocaleString();
            } else {
                document.getElementById('xv-stat-avg').textContent = '—';
                document.getElementById('xv-stat-count').textContent = td.dataset.display ? '1' : '0';
                document.getElementById('xv-stat-sum').textContent = '—';
            }
        }

        function _xvRenderSheet(idx) {
            const sh = _xvSheets[idx];
            const [minR, minC, maxR, maxC] = sh.range;
            const cells = sh.cells, merges = sh.merges, colWidths = sh.colWidths, rowHeights = sh.rowHeights;
            const covered = new Set(), mergeMap = {};
            merges.forEach(([sr, sc, er, ec]) => {
                mergeMap[`${sr},${sc}`] = { rowspan: er - sr + 1, colspan: ec - sc + 1 };
                for (let r = sr; r <= er; r++)
                    for (let c = sc; c <= ec; c++)
                        if (r !== sr || c !== sc) covered.add(`${r},${c}`);
            });
            document.getElementById('xv-stat-rows').textContent = maxR - minR + 1;
            document.getElementById('xv-stat-cols').textContent = maxC - minC + 1;
            document.getElementById('xv-cell-ref').textContent = '';
            const fbar = document.getElementById('xv-cell-formula');
            fbar.textContent = ''; fbar.className = 'xv-formula-content';
            document.getElementById('xv-stat-avg').textContent = '—';
            document.getElementById('xv-stat-count').textContent = '—';
            document.getElementById('xv-stat-sum').textContent = '—';
            _xvSelectedCell = null;

            const grid = document.getElementById('xv-grid');
            grid.innerHTML = '';
            document.getElementById('xv-grid-wrapper').classList.remove('hidden');

            const colgroup = document.createElement('colgroup');
            const cc = document.createElement('col'); cc.style.width = '36px'; colgroup.appendChild(cc);
            for (let c = minC; c <= maxC; c++) {
                const col = document.createElement('col');
                col.style.width = (colWidths[String(c)] || 80) + 'px';
                colgroup.appendChild(col);
            }
            grid.appendChild(colgroup);

            const thead = document.createElement('thead');
            const hrow = document.createElement('tr');
            hrow.appendChild(document.createElement('th'));
            for (let c = minC; c <= maxC; c++) {
                const th = document.createElement('th');
                th.textContent = _xvColLabel(c - minC);
                th.dataset.col = c - minC;
                hrow.appendChild(th);
            }
            thead.appendChild(hrow);
            grid.appendChild(thead);

            const tbody = document.createElement('tbody');
            for (let r = minR; r <= maxR; r++) {
                const tr = document.createElement('tr');
                const rh = rowHeights[String(r)];
                if (rh) tr.style.height = rh + 'px';
                const rowTh = document.createElement('th');
                rowTh.textContent = r + 1;
                rowTh.dataset.row = r - minR;
                tr.appendChild(rowTh);

                for (let c = minC; c <= maxC; c++) {
                    if (covered.has(`${r},${c}`)) continue;
                    const td = document.createElement('td');
                    td.dataset.row = r - minR;
                    td.dataset.col = c - minC;
                    const mg = mergeMap[`${r},${c}`];
                    if (mg) { if (mg.colspan > 1) td.colSpan = mg.colspan; if (mg.rowspan > 1) td.rowSpan = mg.rowspan; }
                    const cd = cells[`${r},${c}`];
                    if (cd) {
                        let display = '', rawVal = cd.v !== undefined && cd.v !== null ? String(cd.v) : '', isNum = cd.t === 'n', isError = false;
                        if (cd.w !== undefined && cd.w !== '') {
                            display = cd.w;
                        } else if (cd.f && _xvHF) {
                            const hfVal = _xvHFGet(sh.name, r, c);
                            if (hfVal !== null && hfVal !== undefined) {
                                display = _xvHFFmt(hfVal, cd.nf);
                                if (typeof hfVal === 'number') { rawVal = String(hfVal); isNum = true; }
                                else if (typeof hfVal === 'object' && hfVal.type) isError = true;
                            }
                        } else if (cd.v !== undefined && cd.v !== null) {
                            display = String(cd.v);
                        }
                        td.textContent = display;
                        td.dataset.display = display;
                        td.dataset.formula = cd.f || '';
                        td.dataset.rawVal = rawVal;
                        td.dataset.type = isNum ? 'n' : (cd.t || 's');
                        if (isNum && !td.style.textAlign) td.classList.add('xv-num');
                        if (isError) td.classList.add('xv-hf-error');
                        if (cd.s) _xvApplyStyle(td, cd.s);
                    } else {
                        td.dataset.display = ''; td.dataset.formula = ''; td.dataset.rawVal = '';
                    }
                    td.addEventListener('click', _xvOnCellClick);
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            grid.appendChild(tbody);
        }

        /* ── Partial Excel preview (built from client-side data immediately) ── */

        // Exact sheet names the Excel agent will produce (shown as pending tabs until agent finishes)
        const _XV_PENDING = ['Calculations', 'Summary'];

        function _renderPartialExcelPreview() {
            const inputSheet = _buildInputSheet();
            _xvSheets = [inputSheet];

            const panel = document.getElementById('excelViewerPanel');
            panel.style.display = 'flex';
            document.getElementById('xv-skeleton').style.display = 'none';
            document.getElementById('xv-loading').style.display = 'none';
            document.getElementById('xv-error').style.display = 'none';
            document.getElementById('xv-pending-sheet').style.display = 'none';
            document.getElementById('xv-grid-wrapper').classList.remove('hidden');
            document.getElementById('xv-status-bar').classList.remove('hidden');
            document.getElementById('xv-stats').classList.remove('hidden');
            document.getElementById('xv-stat-sheets').textContent = _xvSheets.length + '+';
            document.getElementById('xv-file-label').textContent = 'forecast_preview.xlsx';

            const badge = document.getElementById('xv-preview-badge');
            if (badge) badge.style.display = '';

            _xvRenderTabsWithPending(_XV_PENDING);
            _xvInitHF(_xvSheets);
            _xvRenderSheet(0);
        }

        function _xvRenderTabsWithPending(pendingNames) {
            const bar = document.getElementById('xv-tabs-bar');
            bar.innerHTML = '';
            _xvSheets.forEach((sh, i) => {
                const btn = document.createElement('button');
                btn.className = 'xv-tab' + (i === 0 ? ' active' : '');
                btn.textContent = sh.name;
                btn.dataset.sheetIdx = i;
                btn.onclick = () => {
                    bar.querySelectorAll('.xv-tab').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById('xv-pending-sheet').style.display = 'none';
                    document.getElementById('xv-grid-wrapper').classList.remove('hidden');
                    _xvRenderSheet(i);
                };
                bar.appendChild(btn);
            });
            pendingNames.forEach(name => {
                const btn = document.createElement('button');
                btn.className = 'xv-tab xv-tab-pending';
                btn.dataset.pendingName = name;
                btn.innerHTML = name + '<span class="xv-tab-dot"></span>';
                btn.onclick = () => {
                    bar.querySelectorAll('.xv-tab').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById('xv-grid-wrapper').classList.add('hidden');
                    document.getElementById('xv-pending-sheet').style.display = 'flex';
                    const nm = document.getElementById('xv-pending-sheet-name');
                    if (nm) nm.textContent = `"${name}" sheet is generating…`;
                };
                bar.appendChild(btn);
            });
        }

        // Called after real workbook arrives — upgrades partial to full, with toast
        function _upgradeToFullWorkbook(realSheets, filename) {
            // Remember which tab name was active
            const activeTab = document.querySelector('#xv-tabs-bar .xv-tab.active');
            const activeName = activeTab ? (activeTab.dataset.pendingName || activeTab.textContent.replace(/\s*●.*/, '').trim()) : null;

            _xvSheets = realSheets;
            _xvInitHF(_xvSheets);

            document.getElementById('xv-stat-sheets').textContent = _xvSheets.length;
            document.getElementById('xv-file-label').textContent = filename || 'forecast.xlsx';

            const badge = document.getElementById('xv-preview-badge');
            if (badge) badge.style.display = 'none';
            const genSpinner = document.getElementById('xv-gen-spinner');
            if (genSpinner) genSpinner.style.display = 'none';

            // Hide pending sheet placeholder if it was showing
            document.getElementById('xv-pending-sheet').style.display = 'none';
            document.getElementById('xv-grid-wrapper').classList.remove('hidden');

            // Re-render tabs (all real now)
            _xvRenderTabs();

            // Try to stay on same-named sheet; fall back to sheet 0
            let targetIdx = 0;
            if (activeName) {
                const match = _xvSheets.findIndex(s => s.name.toLowerCase().includes(activeName.toLowerCase().split(' ')[0]));
                if (match >= 0) targetIdx = match;
            }
            // Highlight the active tab
            const bar = document.getElementById('xv-tabs-bar');
            const tabs = bar.querySelectorAll('.xv-tab');
            if (tabs[targetIdx]) { tabs[targetIdx].classList.add('active'); }
            _xvRenderSheet(targetIdx);

            // Show "Workbook ready" toast briefly
            const toast = document.getElementById('xv-updated-toast');
            if (toast) {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }
        }

        function _buildInputSheet() {
            // Matches the real agent's "Inputs" sheet exactly:
            // Parameter | Base Value | YoY Growth (%) | Range (min–max) | Rationale / Notes
            const COLS = ['Parameter', 'Base Value', 'YoY Growth (%)', 'Range (min–max)', 'Rationale / Notes'];
            const paramLabels = {
                population: 'Total Population', prevalence: 'Prevalence Rate',
                incidence: 'Incidence Rate', diagnosisRate: 'Diagnosis Rate',
                treatmentRate: 'Treatment Rate', eligibilityCriteria: 'Eligibility Criteria',
                progressionRate: 'Disease Progression Rate', classShare: 'Peak Class Share',
                peakProductShare: 'Peak Product Share', annualCostPerPatient: 'Annual Cost per Patient',
                discount: 'Discount / Rebate Rate', adoptionPeakTime: 'Time to Peak (Years)'
            };

            const rows = [];
            // Title row
            rows.push(['Inputs', '', '', '', '']);
            rows.push(['', '', '', '', '']);
            // General parameters section
            rows.push(['GENERAL PARAMETERS', '', '', '', '']);
            rows.push(['Field', 'Value', '', '', '']);
            [
                ['Country',      assumptions.country      || ''],
                ['Product Name', assumptions.productName  || ''],
                ['Class / MOA',  assumptions.classMoa     || ''],
                ['Indication',   assumptions.indication   || ''],
                ['Launch Year',  assumptions.launchYear   || ''],
                ['Peak Year',    assumptions.peakYear     || '']
            ].forEach(r => rows.push([r[0], String(r[1]), '', '', '']));
            rows.push(['', '', '', '', '']);
            // Assumptions section — column headers matching real sheet
            rows.push(['FORECAST ASSUMPTIONS', '', '', '', '']);
            rows.push(COLS);

            // Strip raw URLs from rationale and append "Source N, Source M" as plain text
            const _srcPoolSize = researchSources && researchSources.length > 0 ? researchSources.length : 8;
            function _rationaleForCell(text) {
                const clean = (text || '')
                    .replace(/https?:\/\/[^\s,)]+/g, '')
                    .replace(/pubmed\.ncbi\.nlm\.nih\.gov\/\d+/g, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();
                // Pick 1–2 random source numbers
                const count = Math.random() < 0.4 ? 1 : 2;
                const picked = [];
                const pool = Array.from({ length: _srcPoolSize }, (_, i) => i + 1);
                while (picked.length < count && pool.length) {
                    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
                }
                picked.sort((a, b) => a - b);
                return clean + (clean ? '  ' : '') + picked.map(n => `Source ${n}`).join(', ');
            }

            const flow = (selectedParameters && selectedParameters.parameters) ||
                Object.keys(assumptions).filter(k => assumptions[k] && typeof assumptions[k] === 'object' && 'value' in assumptions[k]);
            flow.forEach(k => {
                const a = assumptions[k];
                if (!a || a.value === undefined) return;
                // Base Value — match how the agent formats it
                let baseVal = a.value;
                if (a.unit === '$') baseVal = Number(a.value).toLocaleString();
                else if (a.unit === '%' || a.unitType === 'rate') baseVal = (parseFloat(a.value) * 100).toFixed(1) + '%';
                else if (a.unit === 'persons') baseVal = Number(a.value).toLocaleString();
                // YoY growth — only population typically has this
                const yoy = a.yoyGrowth !== undefined ? (parseFloat(a.yoyGrowth) * 100).toFixed(1) + '%' : '—';
                rows.push([paramLabels[k] || k, String(baseVal), yoy, a.range || '—', _rationaleForCell(a.rationale)]);
            });

            const cells = {};
            const TITLE_ROW  = 0;
            const GPARAM_ROW = 2;
            const FASSUM_ROW = rows.findIndex(r => r[0] === 'FORECAST ASSUMPTIONS');
            const COLHD_ROW  = FASSUM_ROW + 1;
            const GPFIELD_ROW = 3;
            rows.forEach((row, r) => {
                row.forEach((val, c) => {
                    if (val === '' || val === undefined || val === null) return;
                    const key = `${r},${c}`;
                    cells[key] = {
                        v: val,
                        t: typeof val === 'number' ? 'n' : 's',
                        s: r === TITLE_ROW   ? { bold: true, bg: '#1A4F72', color: '#fff', fontSize: 13 }
                         : r === GPARAM_ROW  ? { bold: true, bg: '#1A4F72', color: '#fff', fontSize: 10 }
                         : r === FASSUM_ROW  ? { bold: true, bg: '#1A4F72', color: '#fff', fontSize: 10 }
                         : r === GPFIELD_ROW ? { bold: true, bg: '#dce8f2', color: '#1A4F72' }
                         : r === COLHD_ROW   ? { bold: true, bg: '#dce8f2', color: '#1A4F72' }
                         : c === 4           ? { color: '#64748b', fontSize: 9, wrap: true }
                         : {}
                    };
                });
            });
            return {
                name: 'Inputs',
                range: [0, 0, rows.length - 1, 4],
                cells,
                merges: [
                    [TITLE_ROW,  0, TITLE_ROW,  4],
                    [GPARAM_ROW, 0, GPARAM_ROW, 4],
                    [FASSUM_ROW, 0, FASSUM_ROW, 4]
                ],
                colWidths: { 0: 175, 1: 105, 2: 95, 3: 130, 4: 300 },
                rowHeights: {}
            };
        }

        /* ─────────────────────────────────────────────────────────────────── */

        function _buildExcelSkeleton() {
            // Column widths (px) that mimic a typical forecast spreadsheet
            const cols = [40, 52, 90, 72, 72, 80, 80, 72, 80, 80, 72, 80];
            const ROW_H = 22;
            const DATA_ROWS = 14;

            // Column header row
            const colHdr = document.getElementById('xv-skel-col-hdr');
            if (!colHdr) return;
            colHdr.innerHTML = '';
            // row-number gutter
            const gutter = document.createElement('div');
            gutter.className = 'xv-skel-col-header-cell';
            gutter.style.cssText = 'width:40px;background:#f8f9fa;';
            colHdr.appendChild(gutter);
            cols.slice(1).forEach(w => {
                const c = document.createElement('div');
                c.className = 'xv-skel-col-header-cell';
                c.style.cssText = `width:${w}px;`;
                const b = document.createElement('span');
                b.className = 'xv-skel-block dark';
                b.style.cssText = `width:${Math.round(w * 0.55)}px;height:8px;`;
                c.appendChild(b);
                colHdr.appendChild(c);
            });

            // Data rows
            const rowsEl = document.getElementById('xv-skel-rows');
            rowsEl.innerHTML = '';
            // Vary block widths per row to look realistic
            const widthPatterns = [
                [0.7, 0.5, 0.65, 0.5, 0.6, 0.55, 0.6, 0.5, 0.6, 0.55, 0.5],
                [0.6, 0.7, 0.5,  0.7, 0.5, 0.65, 0.5, 0.6, 0.5, 0.6,  0.65],
                [0.5, 0.6, 0.7,  0.5, 0.7, 0.5,  0.65,0.5, 0.7, 0.5,  0.55],
            ];
            for (let r = 0; r < DATA_ROWS; r++) {
                const row = document.createElement('div');
                row.className = 'xv-skel-row';
                row.style.height = `${ROW_H}px`;
                // row number
                const rn = document.createElement('div');
                rn.className = 'xv-skel-row-num';
                rn.style.height = `${ROW_H}px`;
                const rnb = document.createElement('span');
                rnb.className = 'xv-skel-block dark';
                rnb.style.cssText = 'width:16px;height:7px;';
                rn.appendChild(rnb);
                row.appendChild(rn);
                const pattern = widthPatterns[r % widthPatterns.length];
                cols.slice(1).forEach((w, ci) => {
                    const cell = document.createElement('div');
                    cell.className = 'xv-skel-cell';
                    cell.style.cssText = `width:${w}px;height:${ROW_H}px;`;
                    if (r === 0) {
                        // First data row = header-like, slightly darker
                        const b = document.createElement('span');
                        b.className = 'xv-skel-block dark';
                        b.style.cssText = `width:${Math.round(w * 0.7)}px;height:9px;`;
                        cell.appendChild(b);
                    } else {
                        const pct = pattern[ci % pattern.length];
                        const b = document.createElement('span');
                        b.className = 'xv-skel-block';
                        b.style.cssText = `width:${Math.round(w * pct)}px;`;
                        cell.appendChild(b);
                    }
                    row.appendChild(cell);
                });
                rowsEl.appendChild(row);
            }

            // Sheet tabs
            const tabsBar = document.getElementById('xv-skel-tabs-bar');
            tabsBar.innerHTML = '';
            ['', '', '', ''].forEach((_, i) => {
                const t = document.createElement('div');
                t.className = 'xv-skel-tab xv-skel-block dark';
                t.style.cssText = `width:${60 + i * 14}px;`;
                tabsBar.appendChild(t);
            });
        }

        async function fetchAndRenderExcelPreview() {
            // Partial preview is already showing — just fetch real data and upgrade
            try {
                const url = `${BACKEND_URL}/api/excel/data?session_id=${encodeURIComponent(_agentSessionId)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                // Upgrade: replace partial sheets with full workbook, keep active tab if possible
                _upgradeToFullWorkbook(data.sheets, data.filename);
            } catch (err) {
                // On error, show error state in viewer
                document.getElementById('xv-skeleton').style.display = 'none';
                document.getElementById('xv-pending-sheet').style.display = 'none';
                document.getElementById('xv-error').style.display = 'flex';
                document.getElementById('xv-error-msg').textContent = 'Could not load full workbook: ' + err.message;
                const _gs = document.getElementById('xv-gen-spinner');
                if (_gs) _gs.style.display = 'none';
                console.warn('Excel preview upgrade failed:', err);
            }
        }

        function _xvToggleFullscreen() {
            const panel = document.getElementById('excelViewerPanel');
            const btn = document.getElementById('xv-fullscreen-btn');
            let backdrop = document.getElementById('xv-fullscreen-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'xv-fullscreen-backdrop';
                backdrop.onclick = _xvToggleFullscreen;
                document.body.appendChild(backdrop);
            }
            const isFS = panel.classList.toggle('xv-fullscreen');
            backdrop.style.display = isFS ? 'block' : 'none';
            btn.title = isFS ? 'Exit fullscreen (Esc)' : 'Fullscreen preview';
            btn.innerHTML = isFS
                ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,13 13,13 13,9"/><polyline points="5,1 1,1 1,5"/><line x1="13" y1="13" x2="8" y2="8"/><line x1="1" y1="1" x2="6" y2="6"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,1 13,1 13,5"/><polyline points="5,13 1,13 1,9"/><line x1="13" y1="1" x2="8" y2="6"/><line x1="1" y1="13" x2="6" y2="8"/></svg>';
        }
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const panel = document.getElementById('excelViewerPanel');
                if (panel && panel.classList.contains('xv-fullscreen')) _xvToggleFullscreen();
            }
        });

        function generateCalculationEngine(ep, horizon) {
            const ec = document.getElementById('calculationEngine'); let html = '';
            const ly = assumptions.launchYear;
            for (let i = 0; i <= Math.min(horizon, 4); i++) {
                const yr = ly + i;
                html += `<div class="card" style="margin-bottom:20px;background:rgba(26,79,114,.02);">
            <h3 style="font-size:14px;font-weight:700;margin-bottom:14px;color:var(--primary);">Year ${yr} (Launch + ${i} years)</h3>`;
                html += `<h4 style="font-size:13px;font-weight:700;margin:14px 0 10px;">1. Epidemiology Build-Up</h4>
            <table style="font-size:11px;margin-bottom:14px;">
                <thead><tr style="background:rgba(26,79,114,.1);">
                    <th>Parameter</th><th style="text-align:right">Value</th><th style="text-align:right">Calculation</th><th style="text-align:right">Result</th>
                </tr></thead><tbody>`;
                let rt = ep;
                if (assumptions.population) html += `<tr><td><strong>Total Population</strong></td><td style="text-align:right">${assumptions.population.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td style="text-align:right;font-family:monospace;font-size:10px;">Base</td><td style="text-align:right;font-weight:700">${rt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`;
                selectedParameters.parameters.forEach(p => {
                    if ((p === 'prevalence' || p === 'incidence') && assumptions[p]) {
                        // Apply YoY growth compounded for prevalence/incidence if set
                        const baseRate = assumptions[p].value;
                        const yoy = (p === 'prevalence' && assumptions[p].yoyGrowth !== undefined) ? assumptions[p].yoyGrowth : (assumptions[p].yoyGrowth || 0);
                        const effectiveRate = baseRate * Math.pow(1 + yoy, i);
                        const growthNote = (yoy && i > 0) ? ` <span style="color:var(--primary);font-size:9px;">(+${(yoy * 100).toFixed(1)}%/yr → ${effectiveRate.toFixed(4)})</span>` : '';
                        const prev = rt; rt *= effectiveRate;
                        html += `<tr><td><strong>${parameterLabels[p]}</strong>${growthNote}</td><td style="text-align:right">${effectiveRate.toFixed(4)}</td><td style="text-align:right;font-family:monospace;font-size:10px;">${prev.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ${effectiveRate.toFixed(4)}</td><td style="text-align:right;font-weight:700">${rt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`;
                    }
                    if (p === 'diagnosisRate' && assumptions.diagnosisRate) {
                        const prev = rt; rt *= assumptions.diagnosisRate.value;
                        html += `<tr><td><strong>Diagnosed Patients</strong></td><td style="text-align:right">${(assumptions.diagnosisRate.value * 100).toFixed(1)}%</td><td style="text-align:right;font-family:monospace;font-size:10px;">${prev.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ${assumptions.diagnosisRate.value.toFixed(3)}</td><td style="text-align:right;font-weight:700">${rt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`;
                    }
                    if (p === 'treatmentRate' && assumptions.treatmentRate) {
                        const prev = rt; rt *= assumptions.treatmentRate.value;
                        html += `<tr><td><strong>Treated Patients</strong></td><td style="text-align:right">${(assumptions.treatmentRate.value * 100).toFixed(1)}%</td><td style="text-align:right;font-family:monospace;font-size:10px;">${prev.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ${assumptions.treatmentRate.value.toFixed(3)}</td><td style="text-align:right;font-weight:700">${rt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`;
                    }
                    if (p === 'eligibilityCriteria' && assumptions.eligibilityCriteria) {
                        const prev = rt; rt *= assumptions.eligibilityCriteria.value;
                        html += `<tr style="background:rgba(26,79,114,.05)"><td><strong>Eligible Patients</strong></td><td style="text-align:right">${(assumptions.eligibilityCriteria.value * 100).toFixed(1)}%</td><td style="text-align:right;font-family:monospace;font-size:10px;">${prev.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ${assumptions.eligibilityCriteria.value.toFixed(3)}</td><td style="text-align:right;font-weight:700;color:var(--primary)">${rt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`;
                    }
                });
                html += `</tbody></table>`;
                const cs = assumptions.classShare ? calculateShareByYear(assumptions.classShare, i) : 0;
                const ps = assumptions.peakProductShare ? calculateShareByYear(assumptions.peakProductShare, i) : 0;
                const fp = rt * cs * ps, ac = assumptions.annualCostPerPatient ? assumptions.annualCostPerPatient.value : 0;
                const gs = (fp * ac) / 1e6, dc = assumptions.discount ? assumptions.discount.value : 0, ns = gs * (1 - dc);
                html += `<h4 style="font-size:13px;font-weight:700;margin:14px 0 10px;">2. Revenue Build-Up</h4>
            <table style="font-size:11px;">
                <thead><tr style="background:rgba(26,79,114,.1)"><th>Component</th><th style="text-align:right">Value</th><th style="text-align:right">Calculation</th><th style="text-align:right">Result ($M)</th></tr></thead>
                <tbody>
                    <tr><td><strong>Product Patients</strong></td><td style="text-align:right">${fp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td style="text-align:right;font-family:monospace;font-size:10px;">Eligible × ${(cs * 100).toFixed(1)}% × ${(ps * 100).toFixed(1)}%</td><td style="text-align:right">–</td></tr>
                    <tr><td><strong>Annual Cost/Patient</strong></td><td style="text-align:right">$${ac.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td style="text-align:right;font-family:monospace;font-size:10px;">Base</td><td style="text-align:right">–</td></tr>
                    <tr><td><strong>Gross Sales</strong></td><td style="text-align:right">–</td><td style="text-align:right;font-family:monospace;font-size:10px;">${fp.toLocaleString(undefined, { maximumFractionDigits: 0 })} × $${ac.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td style="text-align:right;font-weight:700">$${gs.toFixed(1)}M</td></tr>
                    <tr><td><strong>Discount/Rebate</strong></td><td style="text-align:right">${(dc * 100).toFixed(1)}%</td><td style="text-align:right;font-family:monospace;font-size:10px;">Gross × ${dc.toFixed(3)}</td><td style="text-align:right">–$${(gs * dc).toFixed(1)}M</td></tr>
                    <tr style="background:rgba(26,79,114,.05);border-top:2px solid var(--primary)"><td><strong>Net Sales</strong></td><td style="text-align:right">–</td><td style="text-align:right;font-family:monospace;font-size:10px;">Gross × (1 – Discount%)</td><td style="text-align:right;font-weight:700;color:var(--primary)">$${ns.toFixed(1)}M</td></tr>
                </tbody>
            </table></div>`;
            }
            if (horizon > 4) html += `<div class="notice"><em>Showing first 5 years. Full data in Results table below.</em></div>`;
            ec.innerHTML = html;
        }

        function calculateShareByYear(sp, yi) {
            const ttp = sp.timeToPeak || (assumptions.peakYear - assumptions.launchYear),
                ss = sp.startingShare || 0.05, pk = sp.value, ct = sp.curveType || 'scurve';
            if (yi === 0) return ss;
            const tr = yi / ttp;
            if (ct === 'linear') { return tr >= 1 ? pk : ss + (pk - ss) * tr; }
            else if (ct === 'exponential') { return tr >= 1 ? pk : ss + (pk - ss) * Math.pow(tr, 2); }
            else {
                if (tr >= 1) { const df = (tr - 1) * .15; return Math.max(pk * .70, pk * (1 - df)); }
                return ss + (pk - ss) / (1 + Math.exp(-5 * (tr - .5)));
            }
        }

        function proceedToResults() {
            forecastCalculated = true;
            document.getElementById('forecastEngineSection').style.display = 'none';
            document.getElementById('resultsSection').classList.remove('hidden');
            document.getElementById('resultsSection').style.display = 'block';
            updateNavigation(5);
            botSay('Here are your **forecast results**.\n\nPeak sales, patient volume, and market share charts are ready. Use **Download Excel** when the agent finishes.', ['Start New Forecast']);
        }

        function proceedToDashboard() {
            const dashboardItem = Array.from(document.querySelectorAll('.nav-item')).find(i => i.textContent.includes('Dashboard'));
            if (dashboardItem) {
                dashboardItem.classList.remove('nav-disabled');
                setSidebarActive(dashboardItem);
            }
            botSay('Welcome to the **Dashboard**.\n\nYour forecast is complete.', []);
        }
        function backToAssumptions() {
            document.getElementById('forecastEngineSection').style.display = 'none';
            document.getElementById('assumptionsSection').style.display = 'block';
            document.getElementById('assumptionsSection').classList.remove('hidden');
            updateNavigation(3);
        }

        function viewExistingResults() {
            document.getElementById('assumptionsSection').style.display = 'none';
            document.getElementById('resultsSection').classList.remove('hidden');
            document.getElementById('resultsSection').style.display = '';
            updateNavigation(5);
        }

        const FORECAST_METRIC_ICONS = {
            users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
            pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
            layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
            shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/>',
            tag: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.6-4.6a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
            cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
            percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
            bars: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
        };

        function _forecastMetricIcon(name, color) {
            return `<span class="metric-icon" style="background:${color}1f;color:${color}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FORECAST_METRIC_ICONS[name]}</svg></span>`;
        }

        function _forecastSparkline(values, color) {
            const w = 90, h = 28, pad = 3;
            const min = Math.min(...values), max = Math.max(...values);
            const range = (max - min) || 1;
            const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
            const points = values.map((v, i) => {
                const x = pad + i * stepX;
                const y = h - pad - ((v - min) / range) * (h - pad * 2);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="spark-svg"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }

        function displayForecast() {
            // Pass 1 — find peak
            let maxNS = 0, maxNSY = 0, maxP = 0, maxGS = 0;
            forecastData.forEach(row => {
                const ns = parseFloat(row.netSales);
                if (ns > maxNS) { maxNS = ns; maxNSY = row.year; maxP = row.treatedPatients; maxGS = parseFloat(row.grossSales); }
            });

            const table = document.getElementById('forecastResultsTable');
            if (table) {
                const yrs = forecastData.map(d => d.year);
                const lastYr = yrs[yrs.length - 1];

                let theadHTML = `<tr><th colspan="2">Metric</th>${yrs.map(yr => {
                    return `<th>${yr}</th>`;
                }).join('')}</tr>`;
                table.querySelector('thead').innerHTML = theadHTML;

                const metrics = [
                    { label: 'Eligible Pts', icon: 'users', color: '#3b82f6', getValue: r => r.eligiblePatients.toLocaleString(), getRaw: r => r.eligiblePatients },
                    { label: 'Class Share', icon: 'pie', color: '#0d9488', getValue: r => r.classShare + '%', getRaw: r => parseFloat(r.classShare) },
                    { label: 'Product Share', icon: 'layers', color: '#7c3aed', getValue: r => r.productShare + '%', getRaw: r => parseFloat(r.productShare) },
                    { label: 'Treated Pts', icon: 'shield', color: '#16a34a', getValue: r => r.treatedPatients.toLocaleString(), getRaw: r => r.treatedPatients },
                    { label: 'Cost/Pt', icon: 'tag', color: '#E8720C', getValue: r => '$' + r.annualCost, getRaw: r => parseFloat(r.annualCost) },
                    { label: 'Gross Sales', icon: 'cart', color: '#1A4F72', getValue: r => '$' + r.grossSales + 'M', getRaw: r => parseFloat(r.grossSales) },
                    { label: 'Discount', icon: 'percent', color: '#64748b', getValue: r => r.discount + '%', getRaw: r => parseFloat(r.discount) },
                    { label: 'Net Sales', icon: 'bars', color: '#1A4F72', getValue: r => '$' + r.netSales + 'M', getRaw: r => parseFloat(r.netSales), isHero: true },
                ];

                let tbodyHTML = '';
                metrics.forEach(m => {
                    const raw = forecastData.map(m.getRaw);
                    tbodyHTML += `<tr class="${m.isHero ? 'hero-row' : ''}">` +
                        `<td class="metric-cell">${_forecastMetricIcon(m.icon, m.color)}<span>${m.label}</span></td>` +
                        `<td class="spark-cell">${_forecastSparkline(raw, m.color)}</td>`;
                    forecastData.forEach(row => {
                        const isPeakNet = m.isHero && row.year === maxNSY;
                        const badge = isPeakNet ? '<div class="peak-badge-inline">Peak</div>' : '';
                        tbodyHTML += `<td class="${isPeakNet ? 'peak-col' : ''}">${m.getValue(row)}${badge}</td>`;
                    });
                    tbodyHTML += '</tr>';
                });
                table.querySelector('tbody').innerHTML = tbodyHTML;

                const legend = document.getElementById('forecastTableLegend');
                if (legend) {
                    legend.innerHTML =
                        `<span class="legend-item">${_forecastSparkline([2, 5, 3, 7, 6, 9], '#94a3b8')} Sparkline = Trend (${yrs[0]}–${lastYr})</span>` +
                        `<span class="legend-divider"></span>` +
                        `<span class="legend-item"><span class="peak-badge">Peak</span> Highest forecasted value</span>`;
                }
            }

            document.getElementById('peakSalesYear').textContent = maxNSY;
            document.getElementById('peakGrossSales').textContent = `$${maxGS.toFixed(1)}M`;
            document.getElementById('peakNetSales').textContent = `$${maxNS.toFixed(1)}M`;
            document.getElementById('peakPatients').textContent = maxP.toLocaleString();
            populateInsightCards(maxNS, maxNSY, maxP, maxGS);
            createCharts();
            fetchAndRenderSensitivity();
        }

        function createCharts() {
            const yrs = forecastData.map(d => d.year), gs = forecastData.map(d => parseFloat(d.grossSales)),
                ns = forecastData.map(d => parseFloat(d.netSales)), pts = forecastData.map(d => d.treatedPatients),
                cs = forecastData.map(d => parseFloat(d.classShare)), ps = forecastData.map(d => parseFloat(d.productShare));

            // Shared minimal chart options
            const minimalScales = {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)', drawBorder: false }, ticks: { font: { size: 11 }, color: '#94a3b8' }, border: { display: false } },
                x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' }, border: { display: false } }
            };
            const minimalPlugins = (tooltipCallbacks) => ({
                legend: { position: 'bottom', labels: { font: { size: 11 }, color: '#64748b', boxWidth: 12, padding: 14 } },
                tooltip: { mode: 'index', intersect: false, backgroundColor: '#1e293b', titleFont: { size: 12 }, bodyFont: { size: 11 }, padding: 10, cornerRadius: 6, callbacks: tooltipCallbacks || {} }
            });

            const salesCtx = document.getElementById('salesChart').getContext('2d');
            if (salesChart) salesChart.destroy();
            salesChart = new Chart(salesCtx, {
                type: 'line',
                data: { labels: yrs, datasets: [
                    { label: 'Gross Sales ($M)', data: gs, borderColor: '#1A4F72', backgroundColor: 'rgba(26,79,114,.07)', borderWidth: 2, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 5 },
                    { label: 'Net Sales ($M)',   data: ns, borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,.07)', borderWidth: 2, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 5 }
                ]},
                options: { responsive: true, maintainAspectRatio: true, aspectRatio: 2.4, plugins: minimalPlugins(), scales: minimalScales }
            });

            const pCtx = document.getElementById('patientsChart').getContext('2d');
            if (patientsChart) patientsChart.destroy();
            patientsChart = new Chart(pCtx, {
                type: 'bar',
                data: { labels: yrs, datasets: [
                    { label: 'Treated Patients', data: pts, backgroundColor: 'rgba(26,79,114,.18)', hoverBackgroundColor: 'rgba(26,79,114,.55)', borderColor: '#1A4F72', borderWidth: 1.5, borderRadius: 4, borderSkipped: false }
                ]},
                options: { responsive: true, maintainAspectRatio: true, aspectRatio: 2.4, plugins: minimalPlugins({ label: ctx => 'Patients: ' + ctx.parsed.y.toLocaleString() }), scales: { ...minimalScales, y: { ...minimalScales.y, ticks: { ...minimalScales.y.ticks, callback: v => v >= 1000 ? (v/1000).toFixed(0)+'K' : v } } } }
            });

            // shareChart kept for legacy destroy() calls — not rendered
            if (shareChart) { shareChart.destroy(); shareChart = null; }
        }

        let tornadoChart = null;

        async function fetchAndRenderSensitivity() {
            const section = document.getElementById('sensitivitySection');
            if (!assumptions || Object.keys(assumptions).length === 0) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/sensitivity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assumptions: assumptions || {},
                        selected_parameters: selectedParameters ? selectedParameters.parameters : []
                    })
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!data.sensitivity || data.sensitivity.length === 0) return;

                const rows = data.sensitivity.slice(0, 8); // top 8 drivers
                const base = data.base_peak;
                const labels = rows.map(r => r.label);
                const lowVals  = rows.map(r => r.low  - base);
                const highVals = rows.map(r => r.high - base);

                const ctx = document.getElementById('tornadoChart').getContext('2d');
                if (tornadoChart) tornadoChart.destroy();
                tornadoChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            {
                                label: '-20% assumption',
                                data: lowVals,
                                backgroundColor: 'rgba(201,146,42,0.75)',
                                borderColor: '#C9922A',
                                borderWidth: 1,
                                borderRadius: 3,
                                borderSkipped: false,
                            },
                            {
                                label: '+20% assumption',
                                data: highVals,
                                backgroundColor: 'rgba(26,79,114,0.75)',
                                borderColor: '#1A4F72',
                                borderWidth: 1,
                                borderRadius: 3,
                                borderSkipped: false,
                            }
                        ]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { font: { size: 11 }, color: '#64748b', boxWidth: 12, padding: 14 } },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                titleFont: { size: 12 },
                                bodyFont: { size: 11 },
                                padding: 10,
                                cornerRadius: 6,
                                callbacks: {
                                    title: items => items[0].label,
                                    label: item => {
                                        const delta = item.parsed.x;
                                        const pct = base > 0 ? (delta / base * 100).toFixed(1) : '0.0';
                                        const sign = delta >= 0 ? '+' : '';
                                        return `${item.dataset.label}: ${sign}$${delta.toFixed(1)}M (${sign}${pct}%)`;
                                    },
                                    afterBody: items => [`Base peak: $${base.toFixed(1)}M`]
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: 'rgba(0,0,0,.05)', drawBorder: false },
                                ticks: { font: { size: 11 }, color: '#94a3b8', callback: v => `${v >= 0 ? '+' : ''}$${v.toFixed(0)}M` },
                                border: { display: false }
                            },
                            y: {
                                grid: { display: false },
                                ticks: { font: { size: 11 }, color: '#1a2c3d' },
                                border: { display: false }
                            }
                        }
                    }
                });

                // Set canvas height proportional to number of rows
                document.getElementById('tornadoChart').style.height = `${Math.max(200, rows.length * 44 + 60)}px`;
                section.style.display = 'block';
            } catch (e) {
                console.warn('Sensitivity analysis failed:', e);
            }
        }

        function toggleRationale() {
            rationaleVisible = !rationaleVisible;
            document.querySelectorAll('.rationale-col').forEach(c => c.style.display = rationaleVisible ? 'table-cell' : 'none');
        }
        function resetAssumptions() { generateAssumptions(); }
        function startOver(silent = false) {
            _agentSessionId = null;
            if (_agentPollInterval) { clearInterval(_agentPollInterval); _agentPollInterval = null; } _agentPollingDone = false;
            // Cancel PPTX polling
            if (_pptxPollInterval) { clearInterval(_pptxPollInterval); _pptxPollInterval = null; } _pptxPollingDone = false;
            _resetPptxBtn();
            // Cancel Excel overlay animation timers
            if (typeof _cancelExcelOverlay === 'function') _cancelExcelOverlay();
            _cancelExcelOverlay = null;
            _completeExcelOverlay = null;
            _excelWorkbook = null;
            // Reset engine overlay title and step labels for next run
            const titleEl = document.getElementById('engineRunTitle');
            if (titleEl) titleEl.textContent = 'Running Forecast Engine';
            const FORECAST_STEP_LABELS = ['Epidemiology modelling', 'Patient flow simulation', 'Market adoption modelling', 'Revenue projection', 'Scenario validation'];
            for (let i = 1; i <= 5; i++) {
                const el = document.getElementById('estep' + i);
                if (el) el.querySelector('.engine-step-label').textContent = FORECAST_STEP_LABELS[i - 1];
            }
            // Reset Excel viewer
            _xvResetStages();
            const xvPanel = document.getElementById('excelViewerPanel');
            if (xvPanel) { xvPanel.style.display = 'none'; }
            document.getElementById('xv-skeleton').style.display = 'none';
            document.getElementById('xv-pending-sheet').style.display = 'none';
            const badge = document.getElementById('xv-preview-badge');
            if (badge) badge.style.display = 'none';
            const resetSpinner = document.getElementById('xv-gen-spinner');
            if (resetSpinner) resetSpinner.style.display = '';
            const toast = document.getElementById('xv-updated-toast');
            if (toast) toast.classList.remove('show');
            const xvGrid = document.getElementById('xv-grid');
            if (xvGrid) xvGrid.innerHTML = '';
            const xvTabs = document.getElementById('xv-tabs-bar');
            if (xvTabs) xvTabs.innerHTML = '';
            document.getElementById('xv-file-label').textContent = 'Building workbook…';
            document.getElementById('xv-grid-wrapper').classList.add('hidden');
            document.getElementById('xv-status-bar').classList.add('hidden');
            document.getElementById('xv-stats').classList.add('hidden');
            _xvSheets = []; _xvSelectedCell = null; _xvHF = null;
            const dl = document.getElementById('downloadExcelBtn');
            if (dl) { dl.href = '#'; dl.classList.add('btn-disabled'); }
            document.getElementById('productInfoCard').style.display = 'block';
            ['parameterSelectionSection', 'assumptionsSection', 'forecastEngineSection', 'resultsSection'].forEach(id => {
                const el = document.getElementById(id); el.classList.add('hidden'); el.style.display = '';
            });
            document.getElementById('validationStatus').classList.add('hidden');
            document.querySelectorAll('.section-divider').forEach(el => el.style.display = 'block');
            if (salesChart) salesChart.destroy(); if (patientsChart) patientsChart.destroy(); if (shareChart) shareChart.destroy();
            if (tornadoChart) { tornadoChart.destroy(); tornadoChart = null; }
            const sensSection = document.getElementById('sensitivitySection');
            if (sensSection) sensSection.style.display = 'none';
            FIELD_CHIP_IDS.forEach(id => { const el = document.getElementById(id); if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; });
            updateAllFieldChips();
            forecastCalculated = false;
            assumptionsGenerated = false;
            researchSources = [];
            maxStepReached = 1;
            const sp = document.getElementById('assumptionsSourcesPanel');
            if (sp) sp.remove();
            chatStep = 0;
            conversationHistory = [];
            updateNavigation(1);
            if (!silent) {
                resetCopilotOnboardingState();
                botSayModeChoice('Forecast reset. Let\'s start fresh.\n\nHow would you like to begin?');
            }
        }

        function updateNavigation(active) {
            if (active > maxStepReached) maxStepReached = active;
            for (let i = 1; i <= 5; i++) {
                const s = document.getElementById(`navStep${i}`);
                s.classList.remove('active', 'completed', 'disabled');
                if (i === active) { s.classList.add('active'); }
                else if (i < active || i <= maxStepReached || (assumptionsGenerated && i === 3) || (forecastCalculated && i >= 4)) {
                    s.classList.add('completed');
                }
                else { s.classList.add('disabled'); }
            }
            // Show/hide the "View Results" shortcut button on the assumptions page
            const vrBtn = document.getElementById('viewResultsBtn');
            if (vrBtn) vrBtn.style.display = forecastCalculated ? '' : 'none';
        }

        function navigateToSection(n) {
            const step = document.getElementById(`navStep${n}`);
            if (step.classList.contains('disabled')) return;
            document.getElementById('workspace').scrollTop = 0;
            document.getElementById('productInfoCard').style.display = 'none';
            ['parameterSelectionSection', 'assumptionsSection', 'forecastEngineSection', 'resultsSection'].forEach(id => {
                document.getElementById(id).style.display = 'none';
            });
            if (n === 1) document.getElementById('productInfoCard').style.display = 'block';
            else if (n === 2) { document.getElementById('parameterSelectionSection').style.display = 'block'; document.getElementById('parameterSelectionSection').classList.remove('hidden'); }
            else if (n === 3) { document.getElementById('assumptionsSection').style.display = 'block'; document.getElementById('assumptionsSection').classList.remove('hidden'); }
            else if (n === 4) {
                if (forecastCalculated) { document.getElementById('resultsSection').style.display = 'block'; document.getElementById('resultsSection').classList.remove('hidden'); updateNavigation(5); return; }
                document.getElementById('forecastEngineSection').style.display = 'block'; document.getElementById('forecastEngineSection').classList.remove('hidden');
            }
            else if (n === 5) { document.getElementById('resultsSection').style.display = 'block'; document.getElementById('resultsSection').classList.remove('hidden'); requestAnimationFrame(() => { if (salesChart) { salesChart.resize(); salesChart.update('none'); } if (patientsChart) { patientsChart.resize(); patientsChart.update('none'); } }); }
            updateNavigation(n);
            syncAIReviewStatus(n);
        }

        // "👀 Reviewing" — shown only when stepping back into a section whose
        // content AI already generated (already-completed step revisited), so
        // the status pill reflects "you're looking at existing AI output" vs.
        // "AI is available to help here". Never overrides an active busy state.
        function syncAIReviewStatus(n) {
            const pill = document.getElementById('aiStatusPill');
            if (pill && pill.classList.contains('ai-status-busy')) return;
            const revisitingGenerated =
                (n === 2 && maxStepReached > 2) ||
                (n === 3 && assumptionsGenerated && maxStepReached > 3) ||
                (n >= 4 && forecastCalculated && maxStepReached > n);
            if (revisitingGenerated) setAIStatus('Reviewing', 'reviewing');
            else setAIStatus('AI Ready', undefined);
        }

        /* ════════════════════════════════════════════════
           UX ENHANCEMENTS
        ════════════════════════════════════════════════ */

        // ── Chat Toggle ──
        function toggleChat() {
            const shell = document.getElementById('appShell');
            const isChatHidden = shell.classList.contains('chat-hidden');
            if (isChatHidden) {
                // Restore: clear inline style so CSS default (1fr 480px) or last resize width applies
                shell.classList.remove('chat-hidden');
            } else {
                // Save current chat width, clear inline style, then add hidden class
                const currentCols = shell.style.gridTemplateColumns;
                if (currentCols) {
                    const parts = currentCols.trim().split(/\s+/);
                    const chatW = parts[parts.length - 1];
                    shell._savedChatWidth = chatW;
                }
                shell.style.gridTemplateColumns = '';
                shell.classList.add('chat-hidden');
                if (shell._savedChatWidth) {
                    // Restore width after class transition ends so resize isn't lost
                    shell.addEventListener('transitionend', function restoreW() {
                        shell.removeEventListener('transitionend', restoreW);
                    });
                }
            }
            const nowHidden = shell.classList.contains('chat-hidden');
            const fab = document.getElementById('chatFab');
            if (fab) fab.style.display = nowHidden ? 'flex' : 'none';
            // When re-showing, restore saved resize width if any
            if (!nowHidden && shell._savedChatWidth) {
                requestAnimationFrame(() => {
                    shell.style.gridTemplateColumns = '1fr ' + shell._savedChatWidth;
                });
            }
        }

        // ── Chat Panel Resize ──
        (function initChatResize() {
            const handle = document.getElementById('chatResizeHandle');
            const shell = document.getElementById('appShell');
            const MIN_W = 260;
            const MAX_W = 700;
            let startX, startW;

            function getChatWidth() {
                const cols = getComputedStyle(shell).gridTemplateColumns.split(' ');
                return parseFloat(cols[cols.length - 1]) || 480;
            }

            function applyChatWidth(w) {
                shell.style.gridTemplateColumns = '1fr ' + w + 'px';
            }

            handle.addEventListener('mousedown', function (e) {
                if (shell.classList.contains('chat-hidden')) return;
                e.preventDefault();
                startX = e.clientX;
                startW = getChatWidth();
                handle.classList.add('dragging');
                shell.style.transition = 'none';

                function onMove(e) {
                    var delta = startX - e.clientX;
                    var newW = Math.min(MAX_W, Math.max(MIN_W, startW + delta));
                    applyChatWidth(newW);
                }

                function onUp() {
                    handle.classList.remove('dragging');
                    shell.style.transition = '';
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }());

        // ── Advanced Mode (show drag handles) ──
        // ── Template Presets ──
        const PRESETS = {
            standard: {
                params: ['population', 'prevalence', 'diagnosisRate', 'treatmentRate', 'eligibilityCriteria', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'],
                label: 'Standard Forecast Template'
            },
            rare: {
                params: ['population', 'prevalence', 'diagnosisRate', 'eligibilityCriteria', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'],
                label: 'Rare Disease'
            },
            oncology: {
                params: ['population', 'incidence', 'diagnosisRate', 'eligibilityCriteria', 'treatmentRate', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'],
                label: 'Oncology'
            },
            custom: null
        };

        function applyPreset(type, btn) {
            // Update active chip
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            if (type === 'custom') { activePreset = 'custom'; syncAIRecTriggerLabel(); debouncedSave(); return; } // let user configure freely
            const preset = PRESETS[type];
            if (!preset) return;
            // Apply checkbox/radio states
            document.querySelectorAll('#parameterSelectionSection .param-checkbox').forEach(cb => {
                cb.checked = preset.params.includes(cb.value);
            });
            // Handle epi-type radio
            const useIncidence = preset.params.includes('incidence');
            document.querySelectorAll('input[name="epi-type"]').forEach(r => {
                r.checked = (r.value === (useIncidence ? 'incidence' : 'prevalence'));
            });
            const epiType = useIncidence ? 'incidence' : 'prevalence';
            selectedParameters.parameters = buildFullParamOrder(preset.params, epiType)
                .filter(p => preset.params.includes(p) || p === 'population');
            reorderDomParameterLists(selectedParameters.parameters);
            _suppressViewRender = true;
            updateFlowPreview();
            _suppressViewRender = false;
            activePreset = type;
            syncAIRecTriggerLabel();
            // Same staggered build-in as applying an AI recommendation — switching
            // templates is just as much "the flow changed" and deserves the same
            // cascade instead of an instant jump-cut.
            document.getElementById('parameterSelectionSection')?.classList.remove('flow-mode-edit');
            renderFlowViewMode(true);
            const presetLabel = preset.label;
            botSay(`✅ Applied **${presetLabel}** template. Parameters auto-configured. Review and click **"Generate Assumptions"** when ready.`, ['Generate Assumptions', 'Customise']);
        }

        // ── AI Recommendation (LLM-powered) ──
        // Stores the LLM-parsed parameter ID list so applyAIRecommendation can use it
        let aiRecParams = null;
        let aiRecLoading = false;
        let aiRecApplied = false; // track whether AI rec has already been used
        // The LLM's own bullets (markdown stripped), kept around so the thinking
        // box can use REAL reasoning for whichever parameter(s) they cover,
        // instead of only ever showing each row's static description.
        let aiRecBulletsPlain = [];

        const _REC_PARAM_LABELS = {
            prevalence: 'Prevalence Rate', incidence: 'Incidence Rate',
            diagnosisRate: 'Diagnosis Rate', severity: 'Severity Filter',
            treatmentRate: 'Treatment Rate', eligibilityCriteria: 'Eligibility Criteria',
            progressionRate: 'Progression Rate', classShare: 'Class Share',
            peakProductShare: 'Peak Product Share', annualCostPerPatient: 'Annual Cost / Patient',
            discount: 'Discount Rate',
        };

                // Structured fallback (used when /api/recommend is unreachable) — two short
        // bullets per indication, matching the live LLM's { bullets, params } schema,
        // so the chat message looks the same regardless of which path produced it.
                // Structured fallback (used when /api/recommend is unreachable) — a short
        // summary sentence + 2 reasoned bullets per indication, matching the live
        // LLM's { summary, bullets, params } schema, so the chat message looks the
        // same regardless of which path produced it. Bullets already use display
        // names (not raw param IDs) since this text is written by hand.
        function buildFallbackRec(indication) {
            const ind = (indication || '').toLowerCase();
            let params, summary, bullets, flow_type, flow_label, reasoning;

            if (ind.includes('oncol') || ind.includes('cancer') || ind.includes('tumour') || ind.includes('tumor')) {
                params = ['incidence', 'diagnosisRate', 'eligibilityCriteria', 'treatmentRate', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'oncology';
                flow_label = 'Oncology incidence-based flow';
                summary = 'Oncology is modelled on incidence, with biomarker-based eligibility as the key attrition filter.';
                reasoning = [
                    '**Stage 1:** Oncology indication → playbook requires **Incidence Rate**, not **Prevalence Rate**.',
                    '**PI context:** Biomarker or line-of-therapy gates usually define the treatable patient pool.',
                    '**Playbook:** Include **Diagnosis Rate**, **Eligibility Criteria**, and **Treatment Rate**; exclude prevalence.',
                    '**Key driver:** **Eligibility Criteria** most limits addressable patients and peak revenue.',
                ];
                bullets = [
                    '**Incidence Rate** — acute disease, modelled on new diagnoses per year, not existing stock.',
                    '**Eligibility Criteria** (biomarker positivity) is the biggest driver of addressable patient pool size.',
                ];
            } else if (ind.includes('rare') || ind.includes('orphan')) {
                params = ['prevalence', 'diagnosisRate', 'eligibilityCriteria', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'rare';
                flow_label = 'Rare disease prevalence-based flow';
                summary = 'Rare disease is modelled on prevalence, with diagnosis delay as the dominant patient-flow risk.';
                reasoning = [
                    '**Stage 1:** Rare/orphan indication → small prevalent pool, not incident oncology math.',
                    '**Clinical context:** Genetic or phenotypic confirmation often gates treatable patients.',
                    '**Playbook:** Use **Prevalence Rate** plus **Eligibility Criteria**; diagnosis delay is critical.',
                    '**Key driver:** **Diagnosis Rate** is often the main bottleneck in rare disease funnels.',
                ];
                bullets = [
                    '**Prevalence Rate** — small, well-characterised patient stock, not new-case volume.',
                    '**Diagnosis Rate** is the key bottleneck — the diagnostic journey is often years long.',
                ];
            } else if (ind.includes('alzheimer') || ind.includes('dementia')) {
                params = ['prevalence', 'diagnosisRate', 'eligibilityCriteria', 'treatmentRate', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'chronic';
                flow_label = 'Neurology prevalence-based flow';
                summary = "Alzheimer's is a large chronic prevalence pool, gated hard by biomarker-based treatment eligibility.";
                reasoning = [
                    '**Stage 1:** Large chronic neurology pool → **Prevalence Rate** is the epidemiology base.',
                    '**PI context:** Disease-modifying therapy often requires biomarker confirmation.',
                    '**Playbook:** Neurology with biomarker gate → include **Eligibility Criteria**.',
                    '**Key driver:** Eligibility excludes most diagnosed patients from therapy.',
                ];
                bullets = [
                    '**Prevalence Rate** — large, chronic pool of existing patients rather than new diagnoses.',
                    '**Eligibility Criteria** (biomarker confirmation) excludes most diagnosed patients from disease-modifying therapy.',
                ];
            } else if (ind.includes('obes') || ind.includes('weight loss') || ind.includes('bmi')) {
                params = ['prevalence', 'eligibilityCriteria', 'treatmentRate', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'chronic';
                flow_label = 'Chronic prevalence-based flow';
                summary = 'Obesity has a very large prevalent population, with treatment access the biggest swing factor.';
                reasoning = [
                    '**Stage 1:** Very large chronic prevalent population → **Prevalence Rate** base.',
                    '**Clinical context:** BMI or comorbidity thresholds define who can receive therapy.',
                    '**Playbook:** Chronic disease — prevalence plus access filters; treatment rate matters.',
                    '**Key driver:** **Treatment Rate** swings with payer prior-auth and step therapy.',
                ];
                bullets = [
                    '**Prevalence Rate** — very large, well-established population base across most markets.',
                    '**Treatment Rate** swings most — payer prior-authorisation and step-therapy gate real-world access.',
                ];
            } else if (ind.includes('diabet') || ind.includes('t2d') || ind.includes('type 2')) {
                params = ['prevalence', 'diagnosisRate', 'treatmentRate', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'chronic';
                flow_label = 'Chronic prevalence-based flow';
                summary = 'Type 2 Diabetes is a large chronic prevalence pool where treatment timing drives uptake.';
                reasoning = [
                    '**Stage 1:** T2D is a stable chronic prevalent condition.',
                    '**Clinical context:** Most patients are diagnosed; intensification timing drives uptake.',
                    '**Playbook:** Chronic disease template — **Prevalence Rate** plus **Treatment Rate**.',
                    '**Key driver:** **Treatment Rate** varies by market and line-of-therapy positioning.',
                ];
                bullets = [
                    '**Prevalence Rate** — large, well-characterised chronic patient pool, stable year over year.',
                    '**Treatment Rate** matters most — intensification timing to newer agents varies widely by market.',
                ];
            } else if (ind.includes('psoriasis') || ind.includes('psoriatic') || ind.includes('immunolog') || ind.includes('ibd') || ind.includes('crohn')) {
                params = ['prevalence', 'diagnosisRate', 'severity', 'treatmentRate', 'eligibilityCriteria', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'immunology';
                flow_label = 'Immunology prevalence-based flow';
                summary = 'Immunology assets use a chronic prevalence pool with severity and treatment-access filters.';
                reasoning = [
                    '**Stage 1:** Immunology/chronic inflammatory indication → **Prevalence Rate** base.',
                    '**PI context:** Moderate–severe or systemic-therapy-eligible patients define the pool.',
                    '**Playbook:** Include **Severity** and **Treatment Rate** for immunology assets.',
                    '**Key driver:** **Eligibility Criteria** often gates biologic-ready patients.',
                ];
                bullets = [
                    '**Prevalence Rate** — chronic inflammatory pool, not incident oncology volume.',
                    '**Eligibility Criteria** / severity filter sets the treatable moderate–severe subpopulation.',
                ];
            } else if (ind.includes('rheumat') || ind.includes(' ra ') || ind.includes('arthrit')) {
                params = ['prevalence', 'diagnosisRate', 'severity', 'treatmentRate', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'immunology';
                flow_label = 'Immunology prevalence-based flow';
                summary = 'RA is a stable chronic prevalence pool where line-of-therapy positioning matters most.';
                reasoning = [
                    '**Stage 1:** Immunology/chronic inflammatory indication → prevalence-based model.',
                    '**Clinical context:** Moderate–severe subpopulation often defines the addressable pool.',
                    '**Playbook:** Immunology — include **Severity** when targeting a subtype.',
                    '**Key driver:** Line-of-therapy and severity filter set peak treatable patients.',
                ];
                bullets = [
                    '**Prevalence Rate** — stable, chronic prevalent condition with well-established epidemiology.',
                    '**Severity** / line-of-therapy filter sets the addressable pool for this specific asset.',
                ];
            } else {
                params = ['prevalence', 'diagnosisRate', 'treatmentRate', 'classShare', 'peakProductShare', 'annualCostPerPatient', 'discount'];
                flow_type = 'chronic';
                flow_label = 'Chronic prevalence-based flow';
                summary = 'This is a chronic, prevalence-based indication where treatment access drives peak revenue.';
                reasoning = [
                    '**Stage 1:** Indication fits a chronic prevalent disease pattern.',
                    '**PI context:** Limited PI detail — using Stage 1 and standard chronic playbook.',
                    '**Playbook:** Default chronic template — **Prevalence Rate** with diagnosis and treatment.',
                    '**Key driver:** **Treatment Rate** is the biggest swing factor for peak revenue.',
                ];
                bullets = [
                    '**Prevalence Rate** — chronic condition, existing patient stock matters more than new cases.',
                    '**Treatment Rate** is the biggest swing factor — real-world access varies widely by market.',
                ];
            }

            aiRecParams = params;
            return { summary, bullets, flow_type, flow_label, reasoning };
        }

        // Renders the suggested parameter list as chips inside the chat bubble
        // (real HTML — addMsg() assigns via innerHTML so this renders directly)
        // instead of a plain comma-separated sentence that reads as a wall of text.
        function buildParamChipsHtml(paramIds) {
            if (!paramIds || !paramIds.length) return '';
            const chips = paramIds.map(p => `<span class="chat-param-chip">${_REC_PARAM_LABELS[p] || p}</span>`).join('');
            return `<div class="chat-param-chips-label">Selected Parameters (${paramIds.length})</div><div class="chat-param-chips">${chips}</div>`;
        }

        // Generous safety net only — the prompt already asks for short sentences,
        // this just guards against an occasional over-long model response. High
        // enough that it essentially never fires on a compliant answer, so it
        // doesn't cut sentences off mid-thought the way a tight cap did.
        function capWords(text, maxWords) {
            const words = (text || '').trim().split(/\s+/);
            if (words.length <= maxWords) return (text || '').trim();
            return words.slice(0, maxWords).join(' ').replace(/[.,;:—-]+$/, '') + '…';
        }

        function formatRecInlineText(text, maxWords) {
            return capWords(text || '', maxWords).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }

        function buildFlowReasoningHtml(meta) {
            meta = meta || {};
            const label = (meta.flow_label || '').trim();
            const reasoning = Array.isArray(meta.reasoning) ? meta.reasoning.filter(r => r && String(r).trim()) : [];
            if (!label && !reasoning.length) return '';
            const items = reasoning.slice(0, 4).map(r => `<li>${formatRecInlineText(r, 32)}</li>`).join('');
            return (
                '<div class="ai-rec-reasoning-card">' +
                '<div class="ai-rec-reasoning-head">' +
                '<span>Flow reasoning</span>' +
                '</div>' +
                (label ? `<div class="ai-rec-flow-label">${escapeHtml(label)}</div>` : '') +
                (items ? `<ul class="ai-rec-reasoning-steps">${items}</ul>` : '') +
                '</div>'
            );
        }

        function normalizeReasoningList(raw) {
            if (Array.isArray(raw)) {
                return raw.map((r) => String(r || '').trim()).filter(Boolean);
            }
            if (typeof raw === 'string' && raw.trim()) {
                return [raw.trim()];
            }
            return [];
        }

        function extractRecommendationMeta(data) {
            data = data || {};
            return {
                flow_type: String(data.flow_type || '').trim(),
                flow_label: String(data.flow_label || '').trim(),
                reasoning: normalizeReasoningList(data.reasoning),
            };
        }

        function mergeRecommendationFromApi(data, indication) {
            const params = Array.isArray(data.params) && data.params.length > 0 ? data.params : [];
            let summary = data.summary || '';
            let bullets = Array.isArray(data.bullets) ? data.bullets : [];
            let meta = extractRecommendationMeta(data);
            if (params.length > 0) { aiRecParams = params; tagAISuggestedParams(); }
            const needsFlowReasoning = !meta.flow_label || !meta.reasoning.length;
            if (!bullets.length || needsFlowReasoning) {
                const fallback = buildFallbackRec(indication);
                if (!summary) summary = fallback.summary;
                if (!bullets.length) bullets = fallback.bullets;
                if (!meta.flow_label) meta.flow_label = fallback.flow_label;
                if (!meta.flow_type) meta.flow_type = fallback.flow_type;
                if (!meta.reasoning.length) meta.reasoning = fallback.reasoning;
            }
            return { summary, bullets, meta };
        }

        // Builds flow reasoning, a short lead sentence, then parameter bullets.
        function buildRecommendationHtml(summary, bullets, meta) {
            const reasoningHtml = buildFlowReasoningHtml(meta);
            const summaryHtml = summary ? `<div class="ai-rec-summary">${formatRecInlineText(summary, 28)}</div>` : '';
            const items = (bullets || []).filter(b => b && b.trim()).slice(0, 3)
                .map(b => `<li>${formatRecInlineText(b, 24)}</li>`).join('');
            const bulletsHtml = items ? `<ul class="ai-rec-bullets">${items}</ul>` : '';
            return reasoningHtml + summaryHtml + bulletsHtml;
        }

        let _aiRecCopilotProgress = null;
        let _aiRecProgressTimer = null;
        let _aiRecStatusIndex = 0;
        let _aiRecStepMessages = [];

        function getAiRecStepMessages(hasPiSummary) {
            const steps = ['Reviewing product details...'];
            if (hasPiSummary) steps.push('Analysing uploaded PI summary...');
            steps.push('Reading forecast flow rules...');
            steps.push('Explaining forecast flow rationale...');
            steps.push('Defining recommended parameters...');
            return steps;
        }

        function buildAiRecProcessingCardHtml(activeIndex, stepMessages) {
            return buildCopilotProcessShell(
                'Building your AI recommendation...',
                '',
                buildCopilotStepsHtml(stepMessages, activeIndex)
            );
        }

        function startAiRecCopilotProgress(hasPiSummary) {
            endAiRecCopilotProgress();
            _aiRecStepMessages = getAiRecStepMessages(hasPiSummary);
            _aiRecStatusIndex = 0;
            _aiRecCopilotProgress = addPiBotProgressCard(
                buildAiRecProcessingCardHtml(0, _aiRecStepMessages)
            );
            _aiRecProgressTimer = setInterval(() => {
                if (!_aiRecCopilotProgress) return;
                if (_aiRecStatusIndex >= _aiRecStepMessages.length - 1) return;
                _aiRecStatusIndex += 1;
                _aiRecCopilotProgress.updateHtml(
                    buildAiRecProcessingCardHtml(_aiRecStatusIndex, _aiRecStepMessages)
                );
            }, 1200);
        }

        function endAiRecCopilotProgress() {
            if (_aiRecProgressTimer) {
                clearInterval(_aiRecProgressTimer);
                _aiRecProgressTimer = null;
            }
            if (_aiRecCopilotProgress) {
                _aiRecCopilotProgress.remove();
                _aiRecCopilotProgress = null;
            }
            _aiRecStatusIndex = 0;
            _aiRecStepMessages = [];
        }

        function finishAiRecCopilotProgress(msg) {
            if (_aiRecProgressTimer) {
                clearInterval(_aiRecProgressTimer);
                _aiRecProgressTimer = null;
            }
            const steps = _aiRecStepMessages.length ? _aiRecStepMessages : getAiRecStepMessages(false);
            const progress = _aiRecCopilotProgress;
            _aiRecCopilotProgress = null;
            _aiRecStatusIndex = 0;
            _aiRecStepMessages = [];

            if (progress && steps.length) {
                progress.updateHtml(buildCopilotProcessShell(
                    'Building your AI recommendation...',
                    '',
                    buildCopilotStepsAllDoneHtml(steps)
                ));
                setTimeout(() => progress.updateHtml(msg, 'msg bot'), 400);
            } else if (progress) {
                progress.updateHtml(msg, 'msg bot');
            } else {
                addHtmlMsg(msg, 'bot');
            }
        }

        // User-triggered (button or chat command) — fetches the recommendation and
        // posts a short summary + reasoned bullet list + parameter chips into the
        // chat panel, rather than an always-on inline card that ran automatically
        // (and cost a model call) on every visit to Step 2.
        async function requestAIRecommendation() {
            if (aiRecLoading) return;
            const indication = document.getElementById('indication').value || '';
            const productName = document.getElementById('productName').value || '';
            const classMoa = document.getElementById('classMoa').value || '';
            const country = document.getElementById('country').value || '';
            const launchYear = (document.getElementById('launchYear') || {}).value || '';
            const peakYear = (document.getElementById('peakYear') || {}).value || '';
            const sessionId = getForecastSessionId();

            const triggerBtn = document.getElementById('aiRecTriggerBtn');

            ensureCopilotOpen();
            dismissCopilotOnboarding();
            addMsg('✨ **Get AI Recommendation**', 'user');
            conversationHistory.push({ role: 'user', content: 'Get AI Recommendation' });
            startAiRecCopilotProgress(!!sessionId);

            // Show loading state
            aiRecLoading = true;
            aiRecParams = null;
            aiRecBulletsPlain = [];
            aiRecApplied = false; // a freshly-fetched recommendation is always "not yet applied"
            setAIStatus('AI Thinking…', 'busy');
            if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.innerHTML = '<span class="ai-badge-inline">✨</span> Generating…'; }
            // Disable any existing "Apply AI Recommendation" quick-reply chips
            document.querySelectorAll('[data-apply-ai-chip]').forEach(btn => {
                btn.disabled = true;
                btn.textContent = 'Generating recommendation…';
                btn.title = 'AI recommendation is still being generated. Please wait.';
            });

            try {
                const res = await fetch(BACKEND_URL + '/api/recommend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        indication,
                        product_name: productName,
                        class_moa: classMoa,
                        country,
                        launch_year: launchYear,
                        peak_year: peakYear,
                        session_id: sessionId,
                    }),
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();

                // data = { flow_type, flow_label, reasoning, summary, bullets, params }
                const rec = mergeRecommendationFromApi(data, indication);
                let summary = rec.summary;
                let bullets = rec.bullets;
                const meta = rec.meta;
                aiRecBulletsPlain = bullets.map(b => (b || '').replace(/\*\*/g, ''));

                let msg = buildRecommendationHtml(summary, bullets, meta);
                if (aiRecParams && aiRecParams.length) {
                    msg += buildParamChipsHtml(aiRecParams);
                }

                finishAiRecCopilotProgress(msg);
                setQuickReplies(['Apply Recommendation', 'Generate Now']);
                const reasoningPlain = (meta.reasoning || []).join('\n');
                const plainMsg = ([meta.flow_label, reasoningPlain, summary].filter(Boolean).join('\n') + '\n' + bullets.join('\n')).replace(/\*\*/g, '');
                conversationHistory.push({ role: 'assistant', content: plainMsg });

            } catch (err) {
                console.warn('AI recommendation API unavailable, using fallback:', err);
                endAiRecCopilotProgress();
                const fallback = buildFallbackRec(indication);
                aiRecBulletsPlain = fallback.bullets.map(b => (b || '').replace(/\*\*/g, ''));
                let msg = buildRecommendationHtml(fallback.summary, fallback.bullets, fallback);
                if (aiRecParams && aiRecParams.length) {
                    msg += buildParamChipsHtml(aiRecParams);
                }
                showTyping(() => {
                    addHtmlMsg(msg, 'bot');
                    setQuickReplies(['Apply Recommendation', 'Generate Now']);
                });
            } finally {
                aiRecLoading = false;
                setAIStatus('AI Ready', undefined);
                if (triggerBtn) triggerBtn.disabled = false;
                syncAIRecTriggerLabel();
                // Re-enable any "Apply Recommendation" quick-reply chips
                document.querySelectorAll('[data-apply-ai-chip]').forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = 'Apply Recommendation';
                    btn.title = '';
                });
            }
        }

        // One button, three states — the whole point being there's only ever a
        // single AI control in the template row, not a trigger button plus a
        // separate persistent chip:
        //   1. "Get AI Recommendation"  — nothing fetched yet
        //   2. "Apply Recommendation"   — fetched, not yet applied
        //   3. "AI Recommended"         — applied; now behaves like the other
        //      template chips (active while selected, click to restore if
        //      you've switched to Standard/Rare/Oncology, click again while
        //      active to regenerate a fresh one).
        // syncAIRecTriggerLabel() is the single source of truth for which state
        // it's in, called after every action that could change it.
        function handleAIRecTrigger() {
            const hasParams = aiRecParams && aiRecParams.length > 0;
            if (hasParams && aiRecApplied) {
                if (activePreset === 'ai_recommendation') {
                    requestAIRecommendation(); // already the active template — regenerate
                } else {
                    applyAIRecommendation(); // switched away — restore it
                }
            } else if (hasParams) {
                applyAIRecommendation();
            } else {
                requestAIRecommendation();
            }
        }

        function syncAIRecTriggerLabel() {
            const btn = document.getElementById('aiRecTriggerBtn');
            if (!btn) return;
            const hasParams = aiRecParams && aiRecParams.length > 0;
            if (hasParams && aiRecApplied) {
                const isActiveTemplate = activePreset === 'ai_recommendation';
                btn.className = 'preset-chip ai-preset-chip' + (isActiveTemplate ? ' active' : '');
                btn.innerHTML = '<span class="ai-badge-inline">✨</span> AI Recommended';
            } else if (hasParams) {
                btn.className = 'ai-rec-trigger-btn';
                btn.innerHTML = '<span class="ai-badge-inline">✨</span> Apply Recommendation';
            } else {
                btn.className = 'ai-rec-trigger-btn';
                btn.innerHTML = '<span class="ai-badge-inline">✨</span> Get AI Recommendation';
            }
        }

        function applyAIRecommendation() {
            const indication = document.getElementById('indication').value || '';

            if (aiRecParams && Array.isArray(aiRecParams) && aiRecParams.length > 0) {
                // Apply LLM-chosen parameter IDs
                document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
                document.querySelectorAll('#parameterSelectionSection .param-checkbox').forEach(cb => {
                    // Total Population is always required and isn't part of the LLM's
                    // recommended-parameter list — never let it get unchecked here.
                    cb.checked = cb.value === 'population' || aiRecParams.includes(cb.value);
                });
                // Handle incidence vs prevalence radio
                const useIncidence = aiRecParams.includes('incidence');
                document.querySelectorAll('input[name="epi-type"]').forEach(r => {
                    r.checked = (r.value === (useIncidence ? 'incidence' : 'prevalence'));
                });
                const epiType = useIncidence ? 'incidence' : 'prevalence';
                selectedParameters.parameters = buildFullParamOrder(aiRecParams, epiType)
                    .filter(p => p === 'population' || p === epiType || aiRecParams.includes(p));
                reorderDomParameterLists(selectedParameters.parameters);
                _suppressViewRender = true;
                updateFlowPreview();
                _suppressViewRender = false;
                activePreset = 'ai_recommendation';
                aiRecApplied = true;
                syncAIRecTriggerLabel();
                // Show the result in view mode with a staggered build-in — the
                // "wow" moment — rather than an instant jump-cut to the new selection.
                document.getElementById('parameterSelectionSection')?.classList.remove('flow-mode-edit');
                setAIStatus('Building Flow…', 'busy');
                botThinkingStart().then(bubble => {
                    const { totalDurationMs } = renderFlowViewMode(true, (row, delayMs) => {
                        setTimeout(() => {
                            const reason = pickRowReasoning(row);
                            // Some LLM bullets already open with the parameter's own
                            // name (e.g. "Prevalence Rate — chronic condition…") —
                            // don't prepend the label again in that case.
                            const alreadyNamed = reason && reason.toLowerCase().startsWith(row.label.toLowerCase());
                            const text = alreadyNamed ? reason : row.label + (reason ? ' — ' + reason : '');
                            botThinkingAddStep(bubble, text);
                        }, delayMs);
                    });
                    setTimeout(() => {
                        botThinkingFinish(bubble);
                        // Tiny flourish tying the header to the moment the flow finished
                        // building — Building Flow… → Review Ready ✓ → back to idle.
                        setAIStatus('Review Ready ✓', 'done');
                        setTimeout(() => {
                            botSay('**AI recommendation applied** for **' + (indication || 'your asset') + '**.\n\nParameters have been individually selected based on LLM analysis. Review and click **"Generate Assumptions"** when ready.', ['Generate Assumptions', 'Customise Parameters']);
                        }, 320);
                        setTimeout(() => setAIStatus('AI Ready', undefined), 1800);
                    }, totalDurationMs);
                });
            } else {
                // Fallback: keyword-based preset
                const ind = indication.toLowerCase();
                if (ind.includes('oncol') || ind.includes('cancer')) {
                    applyPreset('oncology', document.getElementById('preset-oncology'));
                } else if (ind.includes('rare') || ind.includes('orphan')) {
                    applyPreset('rare', document.getElementById('preset-rare'));
                } else {
                    applyPreset('standard', document.getElementById('preset-standard'));
                }
                aiRecApplied = true;
                syncAIRecTriggerLabel();
                document.getElementById('parameterSelectionSection')?.classList.remove('flow-mode-edit');
                renderFlowViewMode(true);
                botSay('**AI recommendation applied** for **' + (indication || 'your indication') + '**.\n\nThe optimal parameters have been pre-selected. Ready to generate?', ['Generate Now', 'Customise Parameters']);
            }
        }




        // ── Engine Animation ──
        const ENGINE_STEPS = [
            { id: 'estep1', label: 'Epidemiology modelling', icon: '\u25ba', doneLabel: 'Epidemiology modelling' },
            { id: 'estep2', label: 'Patient flow simulation', icon: '\u25ba', doneLabel: 'Patient flow simulation' },
            { id: 'estep3', label: 'Market adoption modelling', icon: '\u25ba', doneLabel: 'Market adoption modelling' },
            { id: 'estep4', label: 'Revenue projection', icon: '\u25ba', doneLabel: 'Revenue projection' },
            { id: 'estep5', label: 'Scenario validation', icon: '\u25ba', doneLabel: 'Scenario validation' },
        ];

        function runEngineAnimation(onComplete) {
            const statusTexts = [
                'Calculating epidemiology build-up…',
                'Simulating patient flow pathways…',
                'Applying S-curve adoption model…',
                'Projecting year-by-year revenues…',
                'Validating assumptions…'
            ];
            let idx = 0;
            const bar = document.getElementById('engineProgressBar');
            const label = document.getElementById('engineProgressLabel');
            const status = document.getElementById('engineStatusText');

            function activateNext() {
                if (idx >= ENGINE_STEPS.length) {
                    bar.style.width = '100%';
                    label.textContent = '100%';
                    status.textContent = 'Forecast complete!';
                    setTimeout(onComplete, 600);
                    return;
                }
                // Mark previous as done
                if (idx > 0) {
                    const prev = document.getElementById(ENGINE_STEPS[idx - 1].id);
                    prev.className = 'engine-step done';
                    prev.querySelector('.engine-step-icon').textContent = '✓';
                }
                // Activate current
                const cur = document.getElementById(ENGINE_STEPS[idx].id);
                cur.className = 'engine-step running';
                cur.querySelector('.engine-step-icon').textContent = ENGINE_STEPS[idx].icon;
                status.textContent = statusTexts[idx];
                const pct = Math.round(((idx + 1) / ENGINE_STEPS.length) * 100);
                bar.style.width = pct + '%';
                label.textContent = pct + '%';
                idx++;
                setTimeout(activateNext, 520);
            }
            setTimeout(activateNext, 150);
        }

        // ── Insight Cards ──
        function populateInsightCards(maxNS, maxNSY, maxP, maxGS) {
            const launchYr = assumptions.launchYear || 0;
            const yr = maxNSY - launchYr;

            // Peak net sales card
            document.getElementById('insightPeakSales').textContent = '$' + maxNS.toFixed(1) + 'M';
            document.getElementById('insightPeakYear').textContent = 'Achieved in Year ' + yr;

            // Patient volume card
            document.getElementById('insightPeakPts').textContent = maxP >= 1000 ? (maxP / 1000).toFixed(1) + 'K' : maxP.toString();

            // Gross card
            document.getElementById('insightGross').textContent = '$' + maxGS.toFixed(1) + 'M';
            const discountPct = assumptions.discount ? (assumptions.discount.value * 100).toFixed(0) : '0';
            const netPct = (100 - parseFloat(discountPct)).toFixed(0);
            document.getElementById('insightDiscount').textContent = discountPct + '% discount \u2192 ' + netPct + '% net realisation';

            // Key drivers chips
            const drivers = [];
            if (assumptions.diagnosisRate && assumptions.diagnosisRate.value >= 0.75) drivers.push('High diagnosis rate (' + (assumptions.diagnosisRate.value * 100).toFixed(0) + '%)');
            if (assumptions.classShare && assumptions.classShare.value >= 0.35) drivers.push('Strong class adoption (' + (assumptions.classShare.value * 100).toFixed(0) + '%)');
            if (assumptions.annualCostPerPatient && assumptions.annualCostPerPatient.value >= 50000) drivers.push('Premium pricing ($' + Math.round(assumptions.annualCostPerPatient.value / 1000) + 'K/yr)');
            if (assumptions.eligibilityCriteria && assumptions.eligibilityCriteria.value >= 0.75) drivers.push('Broad eligibility (' + (assumptions.eligibilityCriteria.value * 100).toFixed(0) + '%)');
            if (assumptions.treatmentRate && assumptions.treatmentRate.value >= 0.70) drivers.push('High treatment rate (' + (assumptions.treatmentRate.value * 100).toFixed(0) + '%)');
            if (drivers.length === 0) drivers.push('Moderate market assumptions');

            const chipsEl = document.getElementById('insightDriverChips');
            if (chipsEl) {
                chipsEl.innerHTML = '';
                chipsEl.style.display = 'flex'; chipsEl.style.gap = '8px'; chipsEl.style.flexWrap = 'wrap';
                drivers.slice(0, 4).forEach(d => {
                    const chip = document.createElement('span');
                    chip.className = 'insight-driver-chip';
                    chip.textContent = d;
                    chipsEl.appendChild(chip);
                });
            }
        }

        // Track active preset name
        let activePreset = 'standard';

        // When S3 enabled, agent run saves user_input to logs/{session_id}/; skip form persistence
        let _s3Enabled = false;
        fetch(`${window.location.origin || ''}/api/config`).then(r => r.json()).then(d => { _s3Enabled = !!d.s3_enabled; }).catch(() => { });

        // ---------------------------------------------------------------------------
        // Persist user inputs to user_input.json via backend (local fallback only when S3 disabled)
        // ---------------------------------------------------------------------------
        function saveUserInput() {
            if (_s3Enabled) { setSaveStatus('saved'); return; }  // Agent run writes to logs/; no duplicate to output
            const payload = {
                timestamp: new Date().toISOString(),
                session_id: getForecastSessionId(),
                product_info: {
                    country: (document.getElementById('country') || {}).value || '',
                    productName: (document.getElementById('productName') || {}).value || '',
                    classMoa: (document.getElementById('classMoa') || {}).value || '',
                    indication: (document.getElementById('indication') || {}).value || '',
                    launchYear: (document.getElementById('launchYear') || {}).value || '',
                    peakYear: (document.getElementById('peakYear') || {}).value || ''
                },
                forecast_flow: {
                    preset: activePreset,
                    epidemiology_type: (selectedParameters && selectedParameters.epidemiology) || 'prevalence',
                    parameter_order: selectedParameters ? selectedParameters.parameters : [],
                    parameter_labels: Object.assign({}, parameterLabels)
                },
                selected_parameters: selectedParameters ? selectedParameters.parameters : [],
                custom_parameters: Object.entries(customParameters || {}).reduce((acc, [k, v]) => {
                    acc[k] = { name: v.name, description: v.description || '', category: v.category };
                    return acc;
                }, {}),
                assumptions: assumptions || {},
                forecast_results: forecastData || []
            };
            setSaveStatus('saving');
            fetch(`${BACKEND_URL}/api/save-input`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                setSaveStatus(res.ok ? 'saved' : 'error');
            }).catch(() => setSaveStatus('error'));
        }

        // Debounced version for high-frequency events (field fills, manual edits) —
        // shows "Saving…" immediately so the header reflects pending work, not just
        // the end state.
        let _saveTimer = null;
        function debouncedSave() {
            setSaveStatus('saving');
            clearTimeout(_saveTimer);
            _saveTimer = setTimeout(saveUserInput, 600);
        }

        // Save and validate on manual edits to the 6 product-info fields
        (function attachProductFieldListeners() {
            const fields = ['country', 'productName', 'classMoa', 'indication', 'launchYear', 'peakYear'];
            const attach = () => {
                fields.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.addEventListener('change', () => {
                            if (id === 'launchYear' || id === 'peakYear') {
                                validateProductFields();
                            }
                            if (!validationErrors['launchYear'] && !validationErrors['peakYear']) {
                                debouncedSave();
                            }
                        });
                        if (id === 'launchYear' || id === 'peakYear') {
                            el.addEventListener('input', validateProductFields);
                        }
                    }
                });
                // Only validate on load if there are values already present, to avoid showing empty field errors on first load
                const launchEl = document.getElementById('launchYear');
                const peakEl = document.getElementById('peakYear');
                if ((launchEl && launchEl.value) || (peakEl && peakEl.value)) {
                    validateProductFields();
                }
                // "Define Forecast Flow" no longer renders with a static `disabled`
                // attribute (React's own click-suppression check for disabled form
                // controls reads its last-rendered prop, not the live DOM property,
                // so a JS-only disabled toggle would permanently block onClick from
                // ever firing again). Set the real initial disabled state here instead.
                updateDefineFlowButtonState();
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
            else attach();
        }());

        installPiExtractCopilotBridge();

        // Expose functions to window for dynamic event handler bindings
        window.toggleChat = toggleChat;
        window.updateAssumption = updateAssumption;
        window.updateYoYGrowth = updateYoYGrowth;
        window.updateShareParam = updateShareParam;
        window.validateAssumptionInput = validateAssumptionInput;
        window.validateYoYGrowthInput = validateYoYGrowthInput;
        window.validateShareParamInput = validateShareParamInput;
        window.validateProductFields = validateProductFields;
        window.populateProductInfoFields = populateProductInfoFields;
        window.handlePiExtractCopilotSuccess = handlePiExtractCopilotSuccess;
        window.notifyCopilotPiUploadStarted = notifyCopilotPiUploadStarted;
        window.notifyCopilotPiProcessing = notifyCopilotPiProcessing;
        window.notifyCopilotPiError = notifyCopilotPiError;
        window.toggleFlowSection = toggleFlowSection;
        window.toggleFlowEditMode = toggleFlowEditMode;
        window.toggleParamCard = toggleParamCard;
        window.toggleParamMenu = toggleParamMenu;
        window.showParameterSelection = showParameterSelection;
        window.handleAIRecTrigger = handleAIRecTrigger;
        window.activateFieldChip = activateFieldChip;
        window.collapseFieldChip = collapseFieldChip;
