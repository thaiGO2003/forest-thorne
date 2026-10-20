# Per-Unit Motion + Environment + Library Action Preview Plan

Date: 2026-09-20  
Branch: `feature/threejs-migration`  
Owner request: every live unit has its own recognizable idle signature; flying units visibly hover; water-native units create a water patch on the board; Library portrait loops the real idle; add an Action tab for fast animation preview; redraw Gà Trống Rapper.

## Hard rules

- Planning / Combat / Library resolve through the same `createUnitModel()` authority.
- Gameplay cell/root X/Z is never animated by idle.
- Hover height belongs to the model/idle rig, not gameplay coordinates.
- Water patch stays on the board plane while the animal moves above it.
- Each live baseId receives a unique motion signature (motif + deterministic tempo/amplitude/phase); family defaults alone are not sufficient.
- Action preview must not mutate player state or combat state.
- Do not touch `old_src/`.
- No new direct Phaser import under `src/three/**`.

## MOTION-1 — Per-unit idle signatures

- **Source symbol:** `src/three/ThreeUnitMotionProfile.ts`, `ThreeUnitIdleAnimation.ts::updateUnitIdlePose`.
- **Migration method:** classify locomotion/species behavior, then generate a unique signature per baseId. Use non-uniform waveforms and species gestures rather than a universal vertical sine bob.
- **Allowed:** piecewise/compound sine, ease pulses, figure-eight drift, head/wing/body phase offsets, deterministic seed.
- **Forbidden:** one shared bob function for all units, Math.random per frame, moving board X/Z.
- **Targeted Vitest:** all 124 live IDs have unique signatures; repeated resolution is deterministic; amplitudes stay bounded.
- **Runtime evidence:** adjacent units visibly idle differently even when both are the same broad family.
- **Done criterion:** 124/124 signature coverage with no duplicate signature IDs.

## ENV-1 — Hover and water board presentation

- **Source symbol:** `ThreeUnitMotionProfile.ts`, `ThreeUnitModelFactory.ts::createUnitModel`.
- **Migration method:** `hover` profiles receive a fixed rest-height plus species motion; `water` profiles attach a project-owned translucent water patch under the model root.
- **Allowed:** shared puddle geometry/material; subtle ripple ring; hover shadow remains board-owned.
- **Forbidden:** raising gameplay root/cell coordinates, making water patch follow the idle rig, sprite/emoji water.
- **Targeted Vitest:** flight sample has positive rest height; aquatic sample has `unit-water-puddle`; ground sample has neither.
- **Runtime evidence:** birds/flying spirits visibly float; aquatic units stand/swim over a water patch in Planning and Combat.
- **Done criterion:** environment profile is exposed on root userData and rendered by shared model authority.

## CHICKEN-1 — Redraw Gà Trống Rapper

- **Source symbol:** new `src/three/animals/ThreeChickenRapperGeometry.ts`, `ThreeUnitModelFactory.ts`.
- **Migration method:** replace the imported packed chicken silhouette with a Forest Throne-authored rooster: rounded voxel torso, distinct neck/head, yellow beak, red comb + wattle, side wings, two legs/feet, layered upward tail feathers. Preserve `Chicken` model key and star decorations.
- **Allowed:** project-owned procedural voxel geometry, tuned scale/facing.
- **Forbidden:** EverythingLibrary, old packed chicken geometry, flat cube head/body silhouette.
- **Targeted Vitest:** source asset changes to ForestThrone chicken v2; required rooster part metadata present; Library still resolves `crane_blessing → Chicken`.
- **Runtime evidence:** portrait immediately reads as a rooster rather than a white cube.
- **Done criterion:** Planning/Combat/Library all use the new geometry.

## LIB-ACTION-1 — Action tab

- **Source symbol:** new `src/three/ThreeLibraryActionPreview.ts`, `ThreeLibraryModal.ts`.
- **Migration method:** add per-unit detail sub-tab `Hành động / Actions` with controls: Idle, Attack, Skill, Hit/impact, Take Hit, Move. Preview uses the real shared model and motion profile.
- **Allowed:** local preview scene/renderer and deterministic action loop.
- **Forbidden:** touching combat state, reusing icon-only preview.
- **Targeted Vitest:** tab/buttons exist; switching actions updates preview action metadata; disposal cancels RAF/timers.
- **Runtime evidence:** buttons immediately play the selected animation on the chosen star/skin preview.
- **Done criterion:** action preview works from every Library unit detail.

## LIB-IDLE-1 — Animated portrait

- **Source symbol:** `ThreeLibraryUnitPortrait.ts`.
- **Migration method:** replace one-shot detail portrait snapshot with an animated WebGL portrait loop; cards may keep compact snapshots for performance. Portrait defaults to `idle`.
- **Targeted Vitest:** mounted portrait reports `data-preview-action="idle"` and disposes its RAF cleanly.
- **Done criterion:** selected unit portrait visibly idles continuously.

## Per-unit checklist

| Check | # | Unit | Name | Locomotion | Unique signature | Planned idle behavior |
|---|---:|---|---|---|---|---|
| [x] | 1 | `hawk_hunter` | Diều Hâu Săn | hover | `wing-hover-001` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 2 | `monkey_spear` | Khỉ Lao Cành | ground | `upright-shift-002` | vai và tay chuyển trọng lượng lệch pha → nhìn trái/phải → nện ngực rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 3 | `owl_nightshot` | Cú Đêm | hover | `wing-hover-003` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 4 | `wasp_sting` | Ong Bắp Cày | hover | `insect-hover-004` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 5 | `fox_flame` | Cáo Hỏa | ground | `predator-prowl-005` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 6 | `scorpion_shadow` | Bọ Cạp Bóng | ground | `heavy-breathe-006` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 7 | `spider_venom` | Nhện Độc | ground | `spider-listen-007` | hạ thân → nhấc cặp chân trước luân phiên → xoay đầu/ngực ngắn; tempo/amplitude/phase riêng theo baseId |
| [x] | 8 | `weasel_quick` | Chồn Nhanh | ground | `species-breathe-008` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 9 | `jaguar_hunt` | Báo Đốm Săn | ground | `predator-prowl-009` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 10 | `komodo_bite` | Kỳ Đà Khổng Lồ | hover | `insect-hover-010` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 11 | `tiger_fang` | Hổ Nanh | ground | `predator-prowl-011` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 12 | `triceratops_charge` | Bò Rừng Xung Phong | ground | `heavy-breathe-012` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 13 | `jellyfish_shock` | Sứa Điện | water | `swim-pulse-013` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 14 | `newt_fire` | Kỳ Nhông Lửa | hover | `insect-hover-014` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 15 | `salamander_flame` | Thạch Hỏa | ground | `compress-release-015` | nén thân chậm → bật nhẹ → giữ yên lâu hơn → quay đầu; tempo/amplitude/phase riêng theo baseId |
| [x] | 16 | `toad_poison` | Cóc Độc | ground | `compress-release-016` | nén thân chậm → bật nhẹ → giữ yên lâu hơn → quay đầu; tempo/amplitude/phase riêng theo baseId |
| [x] | 17 | `crane_blessing` | Gà Trống Rapper | ground | `rooster-groove-017` | mổ đất → giật đầu theo nhịp → rũ cánh trái/phải → quét đuôi; tempo/amplitude/phase riêng theo baseId |
| [x] | 18 | `deer_song` | Nai Thần Ca | hover | `insect-hover-018` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 19 | `dove_peace` | Bồ Câu Hòa Bình | hover | `wing-hover-019` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 20 | `firefly_heal` | Đom Đóm Chữa | hover | `insect-hover-020` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 21 | `ant_guard` | Kiến Hộ Vệ | ground | `micro-twitch-021` | bước chân nhỏ ngắt quãng + rung râu + dừng bất chợt; tempo/amplitude/phase riêng theo baseId |
| [x] | 22 | `badger_stone` | Lửng Đá | ground | `species-breathe-022` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 23 | `bear_ancient` | Gấu Cổ Thụ | ground | `species-breathe-023` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 24 | `ram_charge` | Cừu Núi Húc | ground | `species-breathe-024` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 25 | `eagle_marksman` | Đại Bàng Xạ Thủ | hover | `wing-hover-025` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 26 | `heron_pierce` | Diệc Xuyên | hover | `wing-hover-026` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 27 | `toucan_snipe` | Chim Mỏ To | hover | `wing-hover-027` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 28 | `woodpecker_drill` | Gõ Kiến Khoan | hover | `wing-hover-028` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 29 | `chameleon_stealth` | Hươu Cao Cổ Ẩn | ground | `predator-prowl-029` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 30 | `mosquito_toxic` | Muỗi Độc | hover | `insect-hover-030` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 31 | `viper_strike` | Giun Tấn Công | ground | `coil-sway-031` | uốn thân chữ S bất đối xứng + đầu thăm dò + ngừng giữa nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 32 | `horse_charge` | Ngựa Chiến | ground | `species-breathe-032` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 33 | `kangaroo_kick` | Kangaroo Đấm | ground | `kangaroo-ready-033` | nén chân sau → nhún rất nhẹ → tay thủ thế → đuôi cân bằng; tempo/amplitude/phase riêng theo baseId |
| [x] | 34 | `otter_river` | Rái Cá Sông | water | `shore-swim-034` | vũng nước nông; chuyển trọng lượng chậm + quét thân/đuôi + ripple; tempo/amplitude/phase riêng theo baseId |
| [x] | 35 | `rhino_quake` | Tê Giác Địa Chấn | ground | `heavy-breathe-035` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 36 | `wolf_alpha` | Sói Thủ Lĩnh | ground | `predator-prowl-036` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 37 | `ice_mage` | Chuồn Chuồn Băng | ground | `species-breathe-037` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 38 | `octopus_mind` | Bạch Tuộc Tâm | water | `swim-pulse-038` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 39 | `squid_ink` | Tôm Phun | water | `swim-pulse-039` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 40 | `worm_ice` | Cóc Băng | ground | `coil-sway-040` | uốn thân chữ S bất đối xứng + đầu thăm dò + ngừng giữa nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 41 | `butterfly_mirror` | Bướm Kính | hover | `insect-hover-041` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 42 | `dryad_tree` | Yêu Tinh Cây | hover | `orbital-drift-042` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 43 | `fairy_forest` | Tiên Rừng | hover | `orbital-drift-043` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 44 | `unicorn_light` | Kỳ Lân Sáng | hover | `dragon-breathe-044` | hover cao + nở ngực/thở + banking + nhịp cánh/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 45 | `armadillo_roll` | Tatu Cuộn | ground | `species-breathe-045` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 46 | `crab_shell` | Cua Giáp | water | `shore-swim-046` | vũng nước nông; chuyển trọng lượng chậm + quét thân/đuôi + ripple; tempo/amplitude/phase riêng theo baseId |
| [x] | 47 | `ox_mountain` | Bò Núi | ground | `heavy-breathe-047` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 48 | `snail_fortress` | Ốc Sên Pháo Đài | ground | `species-breathe-048` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 49 | `falcon_dive` | Chim Non Lao | hover | `wing-hover-049` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 50 | `flamingo_shot` | Hồng Hạc Bắn | hover | `wing-hover-050` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 51 | `pelican_bomb` | Bồ Nông Bom | hover | `wing-hover-051` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 52 | `stork_sniper` | Chim Cánh Cụt Bắn | ground | `penguin-rock-052` | lắc trọng lượng chân trái/phải → vỗ cánh cụt ngắn → nhìn ngang; tempo/amplitude/phase riêng theo baseId |
| [x] | 53 | `bat_blood` | Dơi Huyết | hover | `wing-hover-053` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 54 | `ferret_shadow` | Chồn Hương Bóng | hover | `insect-hover-054` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 55 | `mantis_blade` | Bọ Ngựa Kiếm | ground | `mantis-guard-055` | giơ càng trước → giữ → hạ một bên → nghiêng đầu săn mồi; tempo/amplitude/phase riêng theo baseId |
| [x] | 56 | `mink_silent` | Chồn Mink Im | ground | `species-breathe-056` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 57 | `bison_stampede` | Bò Rừng Dẫm | ground | `heavy-breathe-057` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 58 | `hippo_maul` | Hà Mã Nện | ground | `heavy-breathe-058` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 59 | `wolverine_rage` | Hải Ly Cuồng Nộ | hover | `insect-hover-059` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 60 | `firefly_light` | Đom Đóm Sáng | hover | `insect-hover-060` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 61 | `moth_dust` | Ruồi Đêm Bụi | hover | `insect-hover-061` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 62 | `storm_mage` | Rắn Lôi | ground | `coil-sway-062` | uốn thân chữ S bất đối xứng + đầu thăm dò + ngừng giữa nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 63 | `worm_queen` | Sâu Xanh | ground | `coil-sway-063` | uốn thân chữ S bất đối xứng + đầu thăm dò + ngừng giữa nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 64 | `hyena_pack` | Linh Cẩu Bầy | ground | `predator-prowl-064` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 65 | `nymph_water` | Tiên Nước | water | `shore-swim-065` | vũng nước nông; chuyển trọng lượng chậm + quét thân/đuôi + ripple; tempo/amplitude/phase riêng theo baseId |
| [x] | 66 | `sprite_wind` | Yêu Tinh Gió | hover | `orbital-drift-066` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 67 | `wisp_light` | Hồn Ma Sáng | hover | `orbital-drift-067` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 68 | `golem_stone` | Golem Đá | ground | `heavy-settle-068` | dồn vai/trọng lượng → rung rất nhỏ sau khi đáp → nghỉ dài; tempo/amplitude/phase riêng theo baseId |
| [x] | 69 | `pangolin_plate` | Tê Tê Thiết Giáp | ground | `species-breathe-069` | thở thân + chuyển trọng lượng + đầu/đuôi khác nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 70 | `turtle_mire` | Rùa Đầm Lầy | water | `shore-swim-070` | vũng nước nông; chuyển trọng lượng chậm + quét thân/đuôi + ripple; tempo/amplitude/phase riêng theo baseId |
| [x] | 71 | `walrus_ice` | Hải Mã Băng | water | `shore-swim-071` | vũng nước nông; chuyển trọng lượng chậm + quét thân/đuôi + ripple; tempo/amplitude/phase riêng theo baseId |
| [x] | 72 | `albatross_wind` | Hải Âu Gió | hover | `wing-hover-072` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 73 | `cat_goldbow` | Ong Lửa | hover | `insect-hover-073` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 74 | `condor_sky` | Chim Trời Mây | hover | `wing-hover-074` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 75 | `crow_storm` | Quạ Bão Táp | hover | `wing-hover-075` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 76 | `cobra_venom` | Rắn Hổ Mang | ground | `coil-sway-076` | uốn thân chữ S bất đối xứng + đầu thăm dò + ngừng giữa nhịp; tempo/amplitude/phase riêng theo baseId |
| [x] | 77 | `lynx_echo` | Châu Chấu Gió | ground | `micro-twitch-077` | bước chân nhỏ ngắt quãng + rung râu + dừng bất chợt; tempo/amplitude/phase riêng theo baseId |
| [x] | 78 | `vulture_scavunge` | Kền Kền Ăn Xác | hover | `wing-hover-078` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 79 | `wasp_assassin` | Dao Ong Sát Thủ | hover | `insect-hover-079` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 80 | `beetle_drill` | Bọ Khoan Giáp | ground | `micro-twitch-080` | bước chân nhỏ ngắt quãng + rung râu + dừng bất chợt; tempo/amplitude/phase riêng theo baseId |
| [x] | 81 | `crocodile_bite` | Cá Sấu Đầm | hover | `wing-hover-081` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 82 | `gorilla_smash` | Đười Ươi Phẫn Nộ | ground | `upright-shift-082` | vai và tay chuyển trọng lượng lệch pha → nhìn trái/phải → nện ngực rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 83 | `scorpion_king` | Vua Bọ Cạp | ground | `heavy-breathe-083` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 84 | `beetle_mystic` | Bọ Huyền | ground | `micro-twitch-084` | bước chân nhỏ ngắt quãng + rung râu + dừng bất chợt; tempo/amplitude/phase riêng theo baseId |
| [x] | 85 | `bug_plague` | Bọ Dịch Hạch | ground | `micro-twitch-085` | bước chân nhỏ ngắt quãng + rung râu + dừng bất chợt; tempo/amplitude/phase riêng theo baseId |
| [x] | 86 | `spore_mage` | Nhện Bào Tử | ground | `spider-listen-086` | hạ thân → nhấc cặp chân trước luân phiên → xoay đầu/ngực ngắn; tempo/amplitude/phase riêng theo baseId |
| [x] | 87 | `wasp_arcane` | Ong Phép | hover | `insect-hover-087` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 88 | `angel_guardian` | Thiên Thần Hộ Vệ | hover | `orbital-drift-088` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 89 | `peacock_dazzle` | Khổng Tước Vũ | hover | `wing-hover-089` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 90 | `qilin_breeze` | Kỳ Lân Gió | hover | `dragon-breathe-090` | hover cao + nở ngực/thở + banking + nhịp cánh/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 91 | `swan_grace` | Thiên Nga Trắng | hover | `wing-hover-091` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 92 | `buffalo_mist` | Trâu Sương Mù | hover | `insect-hover-092` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 93 | `elephant_guard` | Voi Thiết Giáp | ground | `micro-twitch-093` | bước chân nhỏ ngắt quãng + rung râu + dừng bất chợt; tempo/amplitude/phase riêng theo baseId |
| [x] | 94 | `mammoth_ancient` | Voi Ma Mút | hover | `insect-hover-094` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 95 | `yak_highland` | Bò Tây Tạng | ground | `heavy-breathe-095` | thở nặng + đổi chân chịu lực + đầu/voi/sừng lắc rất nhẹ; tempo/amplitude/phase riêng theo baseId |
| [x] | 96 | `garuda_divine` | Garuda Thần | hover | `wing-hover-096` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 97 | `phoenix_arrow` | Phượng Hoàng Tên | hover | `wing-hover-097` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 98 | `roc_legend` | Tổ Chim Huyền Thoại | hover | `wing-hover-098` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 99 | `thunderbird_storm` | Chim Sấm Sét | hover | `wing-hover-099` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 100 | `panther_void` | Báo Hư Không | ground | `predator-prowl-100` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 101 | `raven_death` | Linh Hồn Mộ | hover | `orbital-drift-101` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 102 | `reaper_void` | Tử Thần Hư Không | hover | `orbital-drift-102` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 103 | `wraith_shadow` | Ma Bóng Tối | hover | `insect-hover-103` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 104 | `chimera_flame` | Chimera Lửa | hover | `dragon-breathe-104` | hover cao + nở ngực/thở + banking + nhịp cánh/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 105 | `lion_general` | Sư Tử Chiến Tướng | ground | `predator-prowl-105` | vai trước dịch chéo → đầu hạ/nâng → đuôi quét trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 106 | `trex_bite` | Bạo Chúa T-Rex | ground | `predator-weight-shift-106` | dồn chân sau → hạ đầu → quét ngang ngắn → thở nặng; tempo/amplitude/phase riêng theo baseId |
| [x] | 107 | `whale_song` | Cá Voi Cổ Đại | water | `swim-pulse-107` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 108 | `dragon_breath` | Rồng Lửa | hover | `insect-hover-108` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 109 | `kirin_thunder` | Kỳ Lân Lôi | hover | `dragon-breathe-109` | hover cao + nở ngực/thở + banking + nhịp cánh/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 110 | `kraken_void` | Kraken Hư Không | water | `swim-pulse-110` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 111 | `lich_undead` | Lich Bất Tử | hover | `wing-hover-111` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 112 | `lizard_elder` | Rồng Đất Cổ | hover | `insect-hover-112` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 113 | `oracle_wisdom` | Tiên Tri Trí Tuệ | hover | `orbital-drift-113` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 114 | `phoenix_rebirth` | Phượng Hoàng Lửa | hover | `wing-hover-114` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 115 | `seraphim_light` | Seraphim Ánh Sáng | hover | `orbital-drift-115` | trôi hình số 8 nhỏ + xoay thân chậm + nâng-hạ không đều; tempo/amplitude/phase riêng theo baseId |
| [x] | 116 | `dragon_earth` | Rồng Đất | hover | `insect-hover-116` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 117 | `hydra_swamp` | Cá Nóc Đầm Lầy | water | `swim-pulse-117` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 118 | `kraken_deep` | Xoáy Nước Khổng Lồ | water | `swim-pulse-118` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 119 | `titan_earth` | Titan Đất | ground | `heavy-settle-119` | dồn vai/trọng lượng → rung rất nhỏ sau khi đáp → nghỉ dài; tempo/amplitude/phase riêng theo baseId |
| [x] | 120 | `boss_earth_colossus` | Địa Thần Cự Tượng | ground | `heavy-settle-120` | dồn vai/trọng lượng → rung rất nhỏ sau khi đáp → nghỉ dài; tempo/amplitude/phase riêng theo baseId |
| [x] | 121 | `boss_ember_dragon` | Cự Long Hỏa Ngục | hover | `insect-hover-121` | hover thấp + rung cánh nhanh thành cụm + lệch ngang rất nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 122 | `boss_storm_phoenix` | Lôi Phượng Cuồng Phong | hover | `wing-hover-122` | giữ hover cố định + nhịp cánh không đều + gật đầu + banking nhỏ; tempo/amplitude/phase riêng theo baseId |
| [x] | 123 | `boss_tempest_jelly` | Sứa Bão Giông | water | `swim-pulse-123` | vũng nước; bơi lắc chữ S/ellipse + nổi chìm mềm + xúc tu/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |
| [x] | 124 | `boss_venom_hydra` | Hydra Độc Vực | hover | `dragon-breathe-124` | hover cao + nở ngực/thở + banking + nhịp cánh/đuôi trễ pha; tempo/amplitude/phase riêng theo baseId |

## Verification policy

Source rows become SOURCE DONE only after implementation + GitHub readback. Vitest/build/browser remain pending unless actually executed.


## Implementation status — SOURCE IMPLEMENTED

- **MOTION-1:** `4a0f886e` added per-unit motion/environment authority; `71186c4d` replaced the generic bob with motif-specific waveforms. All 124 live IDs resolve deterministic unique signatures pinned by `d5cdd06a`.
- **ENV-1:** `d337c0da` attaches `unit-water-puddle` to water profiles and keeps hover rest-height inside the idle rig. Representative hover/water/ground regressions are in `d5cdd06a`.
- **CHICKEN-1:** `3f3119a7` authored Chicken/Rapper v2 geometry; `d337c0da` made it the live `Chicken` authority. Geometry/provenance regression is in `fda2fa9f`.
- **LIB-ACTION-1:** `2c786d4b` added action controls; `de544dab` added action-capable animated portrait runtime; `4ad3d870` wired the Actions tab; `1cbf1c7a` added Library regression.
- **LIB-IDLE-1:** `de544dab` makes detail portraits loop the real idle pose and captures list-card snapshots from an idle frame.
- **ANIM-OWNERSHIP follow-up (2026-09-22):** shared runtime now dispatches through `ThreeUnitAnimationController`; Gà Trống Rapper owns Idle/Attack/Skill/Take Hit/Move in `ThreeChickenRapperAnimation.ts`; Cô Gà Ngủ Nướng v4 owns floor-mattress + blanket idle, upper-body-only sit-up, boomerang pillow attack, pillow-held oversized-yawn skill with no jump, Take Hit and bedding-slide Move in `ThreeSleepyHenGirlAnimation.ts`. Source-guard regression: `tests/three/threeUnitAnimationOwnership.test.ts`.
- **Verification state:** source implementation + GitHub static readback only. Targeted tests were authored/updated, but Vitest/build/browser/device execution has not been run in this connector session.


## 2026-09-22T18:58:00+07:00 — Spider bespoke visual pass

- `spider_venom` now owns an articulated eight-leg Three.js rig in `src/three/animals/spider/ThreeSpiderRig.ts`.
- `ThreeSpiderAnimation.ts` owns Idle/Attack/Skill/Take Hit/Move. Shared combat/library runtime remains dispatch-only through `ThreeUnitAnimationController`.
- Skill animation follows the authored `Mạng Tơ Bẫy` fantasy: rear/body lift + expanding 3D web trap.
- `spider_venom.webOrbit` now resolves a skin-specific Three palette, 2★/3★ ornaments, stronger web presentation and controller id `spider_venom.webOrbit`.
- Temporary QA mode `DEBUG_UNLOCK_ALL_SKINS = true` exposes every authored skin without achievement/progression gates for visual debugging.
- Verification: source implementation + GitHub static readback only; Vitest/build/browser/device execution remains pending.

## Audit 2026-09-22 20:58 +07:00

- Current HEAD readback: plan remains source-complete; no open checkbox remains.
- The 2026-09-22 canonical-owner cleanup did not replace per-unit motion/action preview ownership with a duplicate rule layer.
- **Still pending before archival:** current-HEAD browser replay of per-unit action loops, environment motion and direct/indirect preview cadence.
