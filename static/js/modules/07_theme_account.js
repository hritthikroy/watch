// ============================================================================
// Module: 07_theme_account.js
// ============================================================================

function toggleSelectAccountModal(event) {
            if (event) event.stopPropagation();
            const dropdown = document.getElementById('tradew-select-acct-dropdown');
            const chevron = document.getElementById('disp-tradew-chevron');
            if (!dropdown) return;
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                dropdown.classList.remove('open');
                if (chevron) chevron.innerText = '&#9660;';
            } else {
                tempSelectedAccount = currentActiveAccount;
                updateAccountCardSelectionUI();
                dropdown.classList.add('open');
                if (chevron) chevron.innerText = '&#9650;';
            }
        }

        function selectAccountOption(choice) {
            tempSelectedAccount = choice;
            updateAccountCardSelectionUI();
        }

        function updateAccountCardSelectionUI() {
            const cardStd = document.getElementById('card-standard');
            const cardDemo = document.getElementById('card-demo');
            if (cardStd && cardDemo) {
                if (tempSelectedAccount === 'standard') {
                    cardStd.classList.add('selected');
                    cardDemo.classList.remove('selected');
                } else {
                    cardDemo.classList.add('selected');
                    cardStd.classList.remove('selected');
                }
            }
        }

        function confirmAccountChoice() {
            currentActiveAccount = tempSelectedAccount;
            try { localStorage.setItem('tradew_active_account', currentActiveAccount); } catch(e) {}
            
            const dropdown = document.getElementById('tradew-select-acct-dropdown');
            const chevron = document.getElementById('disp-tradew-chevron');
            if (dropdown) dropdown.classList.remove('open');
            if (chevron) chevron.innerText = '▼';

            // 1. Completely purge in-memory portfolio state
            cachedPortfolioState = null;

            // 2. Clear all chart lines, badges, and tickets immediately
            if (typeof _clearActiveChartLines === 'function') _clearActiveChartLines();
            if (typeof _elbSetPosition === 'function') _elbSetPosition(null);
            if (typeof _hideOrderLineTickets === 'function') _hideOrderLineTickets();
            if (typeof _hideChartLineCloseControls === 'function') _hideChartLineCloseControls();

            // 3. Clear bottom dock positions table and counter immediately
            const posTbody = document.getElementById("dock-pos-tbody");
            if (posTbody) {
                posTbody.innerHTML = `
                    <tr>
                        <td colspan="13">
                            <div class="tradew-empty-container">
                                <svg width="56" height="56" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:8px;opacity:0.45">
                                    <ellipse cx="40" cy="66" rx="22" ry="5" fill="#2B313A" opacity="0.5"/>
                                    <g transform="rotate(-12, 40, 38)">
                                        <rect x="18" y="16" width="44" height="36" rx="4" fill="#1E2329" stroke="#2B313A" stroke-width="1.5"/>
                                        <line x1="26" y1="27" x2="54" y2="27" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="26" y1="33" x2="48" y2="33" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="26" y1="39" x2="42" y2="39" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                    </g>
                                    <g transform="rotate(6, 40, 42)" opacity="0.5">
                                        <rect x="20" y="24" width="40" height="30" rx="4" fill="#181A20" stroke="#2B313A" stroke-width="1.2"/>
                                    </g>
                                    <circle cx="14" cy="22" r="1.5" fill="#3D4755" opacity="0.6"/>
                                    <circle cx="64" cy="30" r="1" fill="#3D4755" opacity="0.5"/>
                                    <circle cx="60" cy="58" r="1.5" fill="#3D4755" opacity="0.4"/>
                                </svg>
                                <span style="font-size: 13px; font-weight: 400; color: #848E9C;">No records</span>
                            </div>
                        </td>
                    </tr>
                `;
            }
            if (typeof _lastRenderedPosIds !== 'undefined') _lastRenderedPosIds = "";
            const cntPosEl = document.getElementById("cnt-pos");
            if (cntPosEl) cntPosEl.innerText = "0";
            const cntPendEl = document.getElementById("cnt-pending");
            if (cntPendEl) cntPendEl.innerText = "0";

            // 4. Reset floating P&L and balance displays
            if (typeof _setFloatingPnlDisplay === 'function') _setFloatingPnlDisplay(0);

            // 5. Reset multi-position stream
            if (typeof multiPosWs !== 'undefined' && multiPosWs) {
                try { multiPosWs.close(); } catch(e) {}
                multiPosWs = null;
            }
            if (typeof _activeMultiPosStreams !== 'undefined') _activeMultiPosStreams = "";

            // 6. Apply account theme/labels
            applyActiveAccountUI();

            // 7. Request fresh portfolio for the chosen mode
            if (typeof fetchPortfolio === 'function') fetchPortfolio();
        }

        function applyActiveAccountUI() {
            const badge = document.getElementById('disp-tradew-acct-badge');
            const idEl = document.getElementById('disp-tradew-acct-id');
            const balEl = document.getElementById('disp-tradew-bal');
            const pnlEl = document.getElementById('disp-tradew-floating');
            const demoBadge = document.getElementById('badge-action-demo');
            const btnPrimary = document.getElementById('btn-primary-action');

            if (currentActiveAccount === 'standard') {
                if (badge) {
                    badge.innerText = 'LIVE ⚡';
                    badge.style.background = '#F0B90B';
                    badge.style.color = '#000000';
                    badge.style.border = 'none';
                    badge.style.fontWeight = '800';
                    badge.style.boxShadow = '0 0 10px rgba(240, 185, 11, 0.45)';
                }
                if (idEl) {
                    idEl.innerHTML = '#161****1279 <span class="tradew-chevron" id="disp-tradew-chevron">&#9660;</span>';
                }
                if (demoBadge) {
                    demoBadge.innerText = 'LIVE ⚡';
                    demoBadge.style.background = '#F0B90B';
                    demoBadge.style.color = '#000000';
                }
                if (btnPrimary) {
                    btnPrimary.style.boxShadow = '0 0 14px rgba(240, 185, 11, 0.35)';
                }
            } else {
                if (badge) {
                    badge.innerText = 'Demo';
                    badge.style.background = '#1877F2';
                    badge.style.color = '#FFFFFF';
                    badge.style.border = 'none';
                    badge.style.fontWeight = '700';
                    badge.style.boxShadow = 'none';
                }
                if (idEl) {
                    idEl.innerHTML = '#161****1279 <span class="tradew-chevron" id="disp-tradew-chevron">&#9660;</span>';
                }
                if (demoBadge) {
                    demoBadge.innerText = 'DEMO';
                    demoBadge.style.background = 'rgba(0, 0, 0, 0.25)';
                    demoBadge.style.color = '#FFFFFF';
                }
                if (btnPrimary) {
                    btnPrimary.style.boxShadow = 'none';
                }
            }

            if (cachedPortfolioState && cachedPortfolioState.wallet_balance !== undefined) {
                if (balEl) balEl.innerText = cachedPortfolioState.wallet_balance.toFixed(2);
            } else {
                if (balEl && (!balEl.innerText || balEl.innerText === '0.00')) balEl.innerText = '20.55';
            }
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('tradew-select-acct-dropdown');
            const topBar = document.getElementById('tradew-top-account-bar');
            if (dropdown && dropdown.classList.contains('open')) {
                if (!dropdown.contains(e.target) && (!topBar || !topBar.contains(e.target))) {
                    dropdown.classList.remove('open');
                    const chevron = document.getElementById('disp-tradew-chevron');
                    if (chevron) chevron.innerText = '&#9660;';
                }
            }
        });
