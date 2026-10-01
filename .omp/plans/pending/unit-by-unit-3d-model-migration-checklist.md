# Unit-by-unit 3D model migration checklist

> Branch authority: `feature/threejs-migration`
> Generated from live `UNIT_MODEL_MAP` + `data/shop_units.csv` at HEAD `a2d0db23dd74e570b944f008190c67783c75f19f`.
> Owner direction updated 2026-09-20: complete the entire remaining roster in one continuous full-roster migration pass; the previous two-units-per-pass limit is retired.

## Scope and order

- Playable roster authority: `src/data/unitCatalog.ts::UNIT_BY_ID`; dedicated-model completion authority: `src/units/UnitModelFactory.ts::UNIT_MODEL_MAP`.
- Current playable coverage: **120 units**. Bosses tracked separately: **5**. Total checklist scope: **125 unit/boss models**.
- Stable model identities cover **120 live units + 5 bosses**, with authored visual migration at **82 unit-owned compositions complete** (direct in UnitModelFactory + in UnitOwnedRigRegistry). Exactly **38 units remain as placeholders** (16 cost 4, 22 cost 5).
- Completion mode: **UNIT-OWNED MIGRATION IN PROGRESS**. All catalog IDs still resolve through `UnitModelFactory.ts`, but unfinished IDs intentionally render a neutral migration marker rather than guessed animal anatomy.
- The historical B01–B61 labels are retained only as audit/history labels; they no longer constrain implementation cadence.

## Per-unit DONE contract

A unit may be checked DONE only when all of the following are true:

1. The unit module itself owns full-body composition. A `GeneratedUnit:<baseId>` identity or legacy configured wrapper alone does **not** satisfy completion.
2. Asset provenance is recorded. User-supplied source assets are preferred; a custom Forest Throne geometry may be authored when no suitable source asset exists, but it must be labeled honestly.
3. Silhouette/species identity, scale, ground contact, owner-facing direction, shadow behavior and material opacity are explicitly reviewed.
4. Planning and Combat resolve the same model factory/cache authority; migration must not fork gameplay state or add Phaser ownership under `src/three/**`.
5. Basic-attack and skill presentation remains compatible with the unit's canonical attack/action pattern. Visual work must not rewrite combat numbers, targeting, tech, economy or status authority.
6. Targeted Vitest assertions cover model identity, unit-owned provenance, anatomy nodes, star evolution where authored, and representative orientation/runtime invariants.
7. Shared geometry may be cached, but per-unit material/transform/VFX state remains independently disposable.
8. `old_src/` remains protected/read-only. No `any`, suppression directive or direct `phaser` import may be introduced under `src/three/**`.
9. Source/readback evidence may mark SOURCE DONE; test/build/browser PASS is only recorded if actually executed.

## Pass protocol

- Re-read branch HEAD before every write because multiple agents may advance the branch concurrently.
- Ten owner-reviewed models keep their hand-authored/approved geometry.
- Unfinished live IDs use a neutral non-animal migration marker. Metadata/classification may support locomotion or planning, but may not synthesize production anatomy.
- 2★/3★ visual evolution remains mandatory when a unit is migrated; generated tribe/class ornament on a neutral marker does not count as authored star evolution.
- Planning, Combat and Library continue to resolve through the same `createUnitModel()` authority.
- Source/readback may be marked SOURCE DONE; Vitest/build/browser PASS is recorded only if actually executed.

## Approved/current models

| State | Unit | Current dedicated model | Evidence |
|---|---|---|---|
| ✅ DONE | `crane_blessing` — Gà Trống Rapper | `Chicken` | Forest Throne `chicken-rapper-v2`; rooster silhouette with beak/comb/wattle/wings/legs/layered tail; opaque FrontSide model |
| ✅ DONE | `spider_venom` — Nhện Độc | `Spider` | Forest Throne custom 8-leg spider; `Math.PI` model-space facing correction |
| ✅ SOURCE DONE | `hawk_hunter` — Diều Hâu Săn | `HawkHunter` | Forest Throne custom voxel geometry; live hawk visual silhouette; 432 vertices / 216 triangles; +Z authored facing; runtime test not executed |
| ✅ SOURCE DONE | `monkey_spear` — Khỉ Lao Cành | `MonkeySpear` | Forest Throne custom voxel geometry with tail + spear; 432 vertices / 216 triangles; +Z authored facing; runtime test not executed |
| ✅ SOURCE DONE | `owl_nightshot` — Cú Đêm | `OwlNightshot` | Forest Throne custom voxel geometry with purple wings, belly, yellow eyes, beak + moon crest; 480 vertices / 240 triangles; +Z authored facing; runtime test not executed |
| ✅ SOURCE DONE | `wasp_sting` — Ong Bắp Cày | `WaspSting` | Forest Throne custom voxel geometry with striped abdomen, four wings, six legs, antennae + rear stinger; 528 vertices / 264 triangles; +Z authored facing; runtime test not executed |
| ✅ SOURCE DONE | `fox_flame` — Cáo Hỏa | `FoxFlame` | Forest Throne custom voxel geometry with fox head/ears, four legs, segmented flame tail + assassin blade; 576 vertices / 288 triangles; +Z authored facing; runtime test not executed |
| ✅ SOURCE DONE | `scorpion_shadow` — Bọ Cạp Bóng | `ScorpionShadow` | Forest Throne custom voxel geometry with 8 legs, twin pincers, raised segmented tail + gold stinger; 672 vertices / 336 triangles; +Z authored facing; runtime test not executed |
| ✅ SOURCE DONE | `weasel_quick` — Chồn Nhanh | `WeaselQuick` | Forest Throne custom voxel geometry with long low body, pointed muzzle, pale-tipped curved tail + short blade; 576 vertices / 288 triangles; +Z authored facing; runtime test not executed |
| ✅ SOURCE DONE | `jaguar_hunt` — Báo Đốm Săn | `JaguarHunt` | Forest Throne custom voxel geometry with heavier feline body, dark spot blocks + long dark-tipped tail; 696 vertices / 348 triangles; +Z authored facing; runtime test not executed |

## Playable roster checklist

| Check | Batch | Shop order | Unit | Name | State / migration evidence |
|---|---:|---:|---|---|---|
| [x] | B01 | 1 | `hawk_hunter` | Diều Hâu Săn | SOURCE DONE — `HawkHunter`, custom Forest Throne voxel payload, 432v/216t; targeted test added; execution pending |
| [x] | B01 | 2 | `monkey_spear` | Khỉ Lao Cành | SOURCE DONE — `MonkeySpear`, custom Forest Throne voxel payload with tail+spear, 432v/216t; targeted test added; execution pending |
| [x] | B02 | 3 | `owl_nightshot` | Cú Đêm | SOURCE DONE — `OwlNightshot`, custom Forest Throne voxel payload, 480v/240t; targeted test added; execution pending |
| [x] | B02 | 4 | `wasp_sting` | Ong Bắp Cày | SOURCE DONE — `WaspSting`, custom Forest Throne voxel payload, 528v/264t; targeted test added; execution pending |
| [x] | B03 | 5 | `fox_flame` | Cáo Hỏa | SOURCE DONE — `FoxFlame`, custom Forest Throne voxel payload, 576v/288t; targeted test added; execution pending |
| [x] | B03 | 6 | `scorpion_shadow` | Bọ Cạp Bóng | SOURCE DONE — `ScorpionShadow`, custom Forest Throne voxel payload, 672v/336t; targeted test added; execution pending |
| [x] | DONE | 7 | `spider_venom` | Nhện Độc | Dedicated `Spider` override approved |
| [x] | B04 | 8 | `weasel_quick` | Chồn Nhanh | SOURCE DONE — `WeaselQuick`, custom Forest Throne voxel payload, 576v/288t; targeted test added; execution pending |
| [x] | B04 | 9 | `jaguar_hunt` | Báo Đốm Săn | SOURCE DONE — `JaguarHunt`, custom Forest Throne voxel payload, 696v/348t; targeted test added; execution pending |
| [x] | FULL | 10 | `komodo_bite` | Kỳ Đà Khổng Lồ | SOURCE DONE — unit-owned `ThreeKomodoBiteRig.ts`; shared helpers create parts only; v5 unit-owned provenance; execution pending |
| [x] | FULL | 11 | `tiger_fang` | Hổ Nanh | SOURCE DONE — unit-owned TigerFangRig.ts + TigerFangAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 12 | `triceratops_charge` | Bò Rừng Xung Phong | SOURCE DONE — unit-owned TriceratopsChargeRig.ts + TriceratopsChargeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 13 | `jellyfish_shock` | Sứa Điện | SOURCE DONE — unit-owned JellyfishShockRig.ts + JellyfishShockAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 14 | `newt_fire` | Kỳ Nhông Lửa | SOURCE DONE — unit-owned NewtFireRig.ts + NewtFireAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 15 | `salamander_flame` | Thạch Hỏa | SOURCE DONE — unit-owned SalamanderFlameRig.ts + SalamanderFlameAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 16 | `toad_poison` | Cóc Độc | SOURCE DONE — unit-owned ToadPoisonRig.ts + ToadPoisonAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | DONE | 17 | `crane_blessing` | Gà Trống Rapper | Dedicated `Chicken` v2 override approved; project-owned rooster geometry |
| [x] | FULL | 18 | `deer_song` | Nai Thần Ca | SOURCE DONE — unit-owned DeerSongRig.ts + DeerSongAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 19 | `dove_peace` | Bồ Câu Hòa Bình | SOURCE DONE — unit-owned DovePeaceRig.ts + DovePeaceAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 20 | `firefly_heal` | Đom Đóm Chữa | SOURCE DONE — unit-owned FireflyHealRig.ts + FireflyHealAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 21 | `ant_guard` | Kiến Hộ Vệ | SOURCE DONE — unit-owned AntGuardRig.ts + AntGuardAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 22 | `badger_stone` | Lửng Đá | SOURCE DONE — unit-owned BadgerStoneRig.ts + BadgerStoneAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 23 | `bear_ancient` | Gấu Cổ Thụ | SOURCE DONE — unit-owned BearAncientRig.ts + BearAncientAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 24 | `ram_charge` | Cừu Núi Húc | SOURCE DONE — unit-owned RamChargeRig.ts + RamChargeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 25 | `eagle_marksman` | Đại Bàng Xạ Thủ | SOURCE DONE — unit-owned EagleMarksmanRig.ts + EagleMarksmanAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 26 | `heron_pierce` | Diệc Xuyên | SOURCE DONE — unit-owned HeronPierceRig.ts + HeronPierceAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 27 | `toucan_snipe` | Chim Mỏ To | SOURCE DONE — unit-owned ToucanSnipeRig.ts + ToucanSnipeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 28 | `woodpecker_drill` | Gõ Kiến Khoan | SOURCE DONE — unit-owned WoodpeckerDrillRig.ts + WoodpeckerDrillAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 29 | `chameleon_stealth` | Tắc Kè Ẩn | SOURCE DONE — unit-owned ChameleonStealthRig.ts + ChameleonStealthAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 30 | `mosquito_toxic` | Muỗi Độc | SOURCE DONE — unit-owned MosquitoToxicRig.ts + MosquitoToxicAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 31 | `viper_strike` | Giun Tấn Công | SOURCE DONE — unit-owned ViperStrikeRig.ts + ViperStrikeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 32 | `horse_charge` | Ngựa Chiến | SOURCE DONE — unit-owned HorseChargeRig.ts + HorseChargeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 33 | `kangaroo_kick` | Kangaroo Đấm | SOURCE DONE — unit-owned KangarooKickRig.ts + KangarooKickAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 34 | `otter_river` | Rái Cá Sông | SOURCE DONE — unit-owned OtterRiverRig.ts + OtterRiverAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 35 | `rhino_quake` | Tê Giác Địa Chấn | SOURCE DONE — unit-owned RhinoQuakeRig.ts + RhinoQuakeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 36 | `wolf_alpha` | Sói Thủ Lĩnh | SOURCE DONE — unit-owned WolfAlphaRig.ts + WolfAlphaAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 37 | `ice_mage` | Chuồn Chuồn Băng | SOURCE DONE — unit-owned IceMageRig.ts + IceMageAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 38 | `octopus_mind` | Bạch Tuộc Tâm | SOURCE DONE — unit-owned OctopusMindRig.ts + OctopusMindAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 39 | `squid_ink` | Tôm Phun | SOURCE DONE — unit-owned SquidInkRig.ts + SquidInkAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 40 | `worm_ice` | Cóc Băng | SOURCE DONE — unit-owned WormIceRig.ts + WormIceAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 41 | `butterfly_mirror` | Bướm Kính | SOURCE DONE — unit-owned ButterflyMirrorRig.ts + ButterflyMirrorAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 42 | `dryad_tree` | Yêu Tinh Cây | SOURCE DONE — unit-owned DryadTreeRig.ts + DryadTreeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 43 | `fairy_forest` | Tiên Rừng | SOURCE DONE — unit-owned FairyForestRig.ts + FairyForestAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 44 | `unicorn_light` | Kỳ Lân Sáng | SOURCE DONE — unit-owned UnicornLightRig.ts + UnicornLightAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 45 | `armadillo_roll` | Tatu Cuộn | SOURCE DONE — unit-owned ArmadilloRollRig.ts + ArmadilloRollAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 46 | `crab_shell` | Cua Giáp | SOURCE DONE — unit-owned CrabShellRig.ts + CrabShellAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 47 | `ox_mountain` | Bò Núi | SOURCE DONE — unit-owned OxMountainRig.ts + OxMountainAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 48 | `snail_fortress` | Ốc Sên Pháo Đài | SOURCE DONE — unit-owned SnailFortressRig.ts + SnailFortressAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 49 | `falcon_dive` | Chim Non Lao | SOURCE DONE — unit-owned FalconDiveRig.ts + FalconDiveAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 50 | `flamingo_shot` | Hồng Hạc Bắn | SOURCE DONE — unit-owned FlamingoShotRig.ts + FlamingoShotAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 51 | `pelican_bomb` | Bồ Nông Bom | SOURCE DONE — unit-owned PelicanBombRig.ts + PelicanBombAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 52 | `stork_sniper` | Chim Cánh Cụt Bắn | SOURCE DONE — unit-owned StorkSniperRig.ts + StorkSniperAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 53 | `bat_blood` | Dơi Huyết | SOURCE DONE — unit-owned BatBloodRig.ts + BatBloodAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 54 | `ferret_shadow` | Chồn Hương Bóng | SOURCE DONE — unit-owned FerretShadowRig.ts + FerretShadowAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 55 | `mantis_blade` | Bọ Ngựa Kiếm | SOURCE DONE — unit-owned MantisBladeRig.ts + MantisBladeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 56 | `mink_silent` | Chồn Mink Im | SOURCE DONE — unit-owned MinkSilentRig.ts + MinkSilentAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 57 | `bison_stampede` | Bò Rừng Dẫm | SOURCE DONE — unit-owned BisonStampedeRig.ts + BisonStampedeAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 58 | `hippo_maul` | Hà Mã Nện | SOURCE DONE — unit-owned HippoMaulRig.ts + HippoMaulAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 60 | `wolverine_rage` | Hải Ly Cuồng Nộ | SOURCE DONE — unit-owned WolverineRageRig.ts + WolverineRageAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 61 | `firefly_light` | Đom Đóm Sáng | SOURCE DONE — unit-owned FireflyLightRig.ts + FireflyLightAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 62 | `moth_dust` | Ruồi Đêm Bụi | SOURCE DONE — unit-owned MothDustRig.ts + MothDustAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 63 | `storm_mage` | Rắn Lôi | SOURCE DONE — unit-owned StormMageRig.ts + StormMageAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 64 | `worm_queen` | Sâu Xanh | SOURCE DONE — unit-owned WormQueenRig.ts + WormQueenAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 65 | `hyena_pack` | Linh Cẩu Bầy | SOURCE DONE — unit-owned HyenaPackRig.ts + HyenaPackAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 66 | `nymph_water` | Tiên Nước | SOURCE DONE — unit-owned NymphWaterRig.ts + NymphWaterAnimation.ts; v5 unit-owned provenance; targeted test added; execution pending |
| [x] | FULL | 67 | `sprite_wind` | Yêu Tinh Gió | SOURCE DONE — unit-owned SpriteWindRig.ts + SpriteWindAnimation.ts; registered in UnitOwnedRigRegistry |
| [x] | FULL | 68 | `wisp_light` | Hồn Ma Sáng | SOURCE DONE — unit-owned WispLightRig.ts + WispLightAnimation.ts; registered in UnitOwnedRigRegistry |
| [x] | FULL | 69 | `golem_stone` | Golem Đá | SOURCE DONE — unit-owned GolemStoneRig.ts + GolemStoneAnimation.ts; registered in UnitOwnedRigRegistry |
| [x] | FULL | 70 | `pangolin_plate` | Tê Tê Thiết Giáp | SOURCE DONE — unit-owned PangolinPlateRig.ts + PangolinPlateAnimation.ts; registered in UnitOwnedRigRegistry |
| [x] | FULL | 71 | `turtle_mire` | Rùa Đầm Lầy | SOURCE DONE — unit-owned TurtleMireRig.ts + TurtleMireAnimation.ts; registered in UnitOwnedRigRegistry |
| [x] | FULL | 72 | `walrus_ice` | Hải Mã Băng | SOURCE DONE — unit-owned WalrusIceRig.ts + WalrusIceAnimation.ts; registered in UnitOwnedRigRegistry |
| [x] | FULL | 73 | `albatross_wind` | Hải Âu Gió | SOURCE DONE — unit-owned AlbatrossWindRig.ts + AlbatrossWindAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [x] | FULL | 74 | `cat_goldbow` | Ong Lửa | SOURCE DONE — unit-owned CatGoldbowRig.ts + CatGoldbowAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [x] | FULL | 75 | `condor_sky` | Chim Trời Mây | SOURCE DONE — unit-owned CondorSkyRig.ts + CondorSkyAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [x] | FULL | 76 | `crow_storm` | Quạ Bão Táp | SOURCE DONE — unit-owned CrowStormRig.ts + CrowStormAnimation.ts; registered in UnitOwnedRigRegistry |
| [x] | FULL | 77 | `cobra_venom` | Rắn Hổ Mang | SOURCE DONE — unit-owned CobraVenomRig.ts + CobraVenomAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [ ] | FULL | 78 | `lynx_echo` | Châu Chấu Gió | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 79 | `vulture_scavunge` | Kền Kền Ăn Xác | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 80 | `wasp_assassin` | Dao Ong Sát Thủ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [x] | FULL | 81 | `beetle_drill` | Bọ Khoan Giáp | SOURCE DONE — unit-owned BeetleDrillRig.ts + BeetleDrillAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [ ] | FULL | 82 | `crocodile_bite` | Cá Sấu Đầm | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 83 | `gorilla_smash` | Đười Ươi Phẫn Nộ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [x] | FULL | 84 | `scorpion_king` | Vua Bọ Cạp | SOURCE DONE — unit-owned ScorpionKingRig.ts + ScorpionKingAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [x] | FULL | 85 | `beetle_mystic` | Bọ Huyền | SOURCE DONE — unit-owned BeetleMysticRig.ts + BeetleMysticAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [x] | FULL | 86 | `bug_plague` | Bọ Dịch Hạch | SOURCE DONE — unit-owned BugPlagueRig.ts + BugPlagueAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [x] | FULL | 87 | `spore_mage` | Nhện Bào Tử | SOURCE DONE — unit-owned SporeMageRig.ts + SporeMageAnimation.ts; registered in UnitOwnedRigRegistry; targeted visual test added |
| [ ] | FULL | 88 | `wasp_arcane` | Ong Phép | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 89 | `angel_guardian` | Thiên Thần Hộ Vệ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 90 | `peacock_dazzle` | Khổng Tước Vũ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 91 | `qilin_breeze` | Kỳ Lân Gió | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 92 | `swan_grace` | Thiên Nga Trắng | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 93 | `buffalo_mist` | Trâu Sương Mù | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 94 | `elephant_guard` | Voi Thiết Giáp | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 95 | `mammoth_ancient` | Voi Ma Mút | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 96 | `yak_highland` | Bò Tây Tạng | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 97 | `garuda_divine` | Garuda Thần | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 98 | `phoenix_arrow` | Phượng Hoàng Tên | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 99 | `roc_legend` | Tổ Chim Huyền Thoại | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 100 | `thunderbird_storm` | Chim Sấm Sét | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 101 | `panther_void` | Báo Hư Không | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 102 | `raven_death` | Linh Hồn Mộ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 103 | `reaper_void` | Tử Thần Hư Không | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 104 | `wraith_shadow` | Ma Bóng Tối | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 105 | `chimera_flame` | Chimera Lửa | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 106 | `lion_general` | Sư Tử Chiến Tướng | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 107 | `trex_bite` | Bạo Chúa T-Rex | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 108 | `whale_song` | Cá Voi Cổ Đại | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 109 | `dragon_breath` | Rồng Lửa | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 110 | `kirin_thunder` | Kỳ Lân Lôi | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 111 | `kraken_void` | Kraken Hư Không | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 112 | `lich_undead` | Lich Bất Tử | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 113 | `lizard_elder` | Rồng Đất Cổ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 114 | `oracle_wisdom` | Tiên Tri Trí Tuệ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 115 | `phoenix_rebirth` | Phượng Hoàng Lửa | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 116 | `seraphim_light` | Seraphim Ánh Sáng | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 117 | `dragon_earth` | Rồng Đất | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 118 | `hydra_swamp` | Cá Nóc Đầm Lầy | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 119 | `kraken_deep` | Xoáy Nước Khổng Lồ | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |
| [ ] | FULL | 120 | `titan_earth` | Titan Đất | PENDING UNIT-OWNED COMPOSITION — legacy generated/whole-auto-body completion invalidated; production uses neutral migration marker |

## Boss checklist

| Check | Batch | Boss | Name | State / migration evidence |
|---|---:|---|---|---|
| [x] | FULL | `boss_earth_colossus` | Địa Thần Cự Tượng | SOURCE DONE — `GeneratedUnit:boss_earth_colossus`; project-owned boss voxel geometry; generated 2★/3★ evolution; execution pending |
| [x] | FULL | `boss_ember_dragon` | Cự Long Hỏa Ngục | SOURCE DONE — `GeneratedUnit:boss_ember_dragon`; project-owned boss voxel geometry; generated 2★/3★ evolution; execution pending |
| [x] | FULL | `boss_storm_phoenix` | Lôi Phượng Cuồng Phong | SOURCE DONE — `GeneratedUnit:boss_storm_phoenix`; project-owned boss voxel geometry; generated 2★/3★ evolution; execution pending |
| [x] | FULL | `boss_tempest_jelly` | Sứa Bão Giông | SOURCE DONE — `GeneratedUnit:boss_tempest_jelly`; project-owned boss voxel geometry; generated 2★/3★ evolution; execution pending |
| [x] | FULL | `boss_venom_hydra` | Hydra Độc Vực | SOURCE DONE — `GeneratedUnit:boss_venom_hydra`; project-owned boss voxel geometry; generated 2★/3★ evolution; execution pending |

## Batch queue

- [x] B01 — SOURCE DONE: `hawk_hunter` (Diều Hâu Săn) + `monkey_spear` (Khỉ Lao Cành); targeted Vitest added, execution pending
- [x] B02 — SOURCE DONE: `owl_nightshot` (Cú Đêm) + `wasp_sting` (Ong Bắp Cày); targeted Vitest added, execution pending
- [x] B03 — SOURCE DONE: `fox_flame` (Cáo Hỏa) + `scorpion_shadow` (Bọ Cạp Bóng); targeted Vitest added, execution pending
- [x] B04 — SOURCE DONE: `weasel_quick` (Chồn Nhanh) + `jaguar_hunt` (Báo Đốm Săn); targeted Vitest added, execution pending
- [x] B05 — FULL-ROSTER SOURCE DONE: `komodo_bite` (Kỳ Đà Khổng Lồ) + `tiger_fang` (Hổ Nanh)
- [x] B06 — FULL-ROSTER SOURCE DONE: `triceratops_charge` (Bò Rừng Xung Phong) + `jellyfish_shock` (Sứa Điện)
- [x] B07 — FULL-ROSTER SOURCE DONE: `newt_fire` (Kỳ Nhông Lửa) + `salamander_flame` (Thạch Hỏa)
- [x] B08 — FULL-ROSTER SOURCE DONE: `toad_poison` (Cóc Độc) + `deer_song` (Nai Thần Ca)
- [x] B09 — FULL-ROSTER SOURCE DONE: `dove_peace` (Bồ Câu Hòa Bình) + `firefly_heal` (Đom Đóm Chữa)
- [x] B10 — FULL-ROSTER SOURCE DONE: `ant_guard` (Kiến Hộ Vệ) + `badger_stone` (Lửng Đá)
- [x] B11 — FULL-ROSTER SOURCE DONE: `bear_ancient` (Gấu Cổ Thụ) + `ram_charge` (Cừu Núi Húc)
- [x] B12 — FULL-ROSTER SOURCE DONE: `eagle_marksman` (Đại Bàng Xạ Thủ) + `heron_pierce` (Diệc Xuyên)
- [x] B13 — FULL-ROSTER SOURCE DONE: `toucan_snipe` (Chim Mỏ To) + `woodpecker_drill` (Gõ Kiến Khoan)
- [x] B14 — FULL-ROSTER SOURCE DONE: `chameleon_stealth` (Hươu Cao Cổ Ẩn) + `mosquito_toxic` (Muỗi Độc)
- [x] B15 — FULL-ROSTER SOURCE DONE: `viper_strike` (Giun Tấn Công) + `horse_charge` (Ngựa Chiến)
- [x] B16 — FULL-ROSTER SOURCE DONE: `kangaroo_kick` (Kangaroo Đấm) + `otter_river` (Rái Cá Sông)
- [x] B17 — FULL-ROSTER SOURCE DONE: `rhino_quake` (Tê Giác Địa Chấn) + `wolf_alpha` (Sói Thủ Lĩnh)
- [x] B18 — FULL-ROSTER SOURCE DONE: `ice_mage` (Chuồn Chuồn Băng) + `octopus_mind` (Bạch Tuộc Tâm)
- [x] B19 — FULL-ROSTER SOURCE DONE: `squid_ink` (Tôm Phun) + `worm_ice` (Cóc Băng)
- [x] B20 — FULL-ROSTER SOURCE DONE: `butterfly_mirror` (Bướm Kính) + `dryad_tree` (Yêu Tinh Cây)
- [x] B21 — FULL-ROSTER SOURCE DONE: `fairy_forest` (Tiên Rừng) + `unicorn_light` (Kỳ Lân Sáng)
- [x] B22 — FULL-ROSTER SOURCE DONE: `armadillo_roll` (Tatu Cuộn) + `crab_shell` (Cua Giáp)
- [x] B23 — FULL-ROSTER SOURCE DONE: `ox_mountain` (Bò Núi) + `snail_fortress` (Ốc Sên Pháo Đài)
- [x] B24 — FULL-ROSTER SOURCE DONE: `falcon_dive` (Chim Non Lao) + `flamingo_shot` (Hồng Hạc Bắn)
- [x] B25 — FULL-ROSTER SOURCE DONE: `pelican_bomb` (Bồ Nông Bom) + `stork_sniper` (Chim Cánh Cụt Bắn)
- [x] B26 — FULL-ROSTER SOURCE DONE: `bat_blood` (Dơi Huyết) + `ferret_shadow` (Chồn Hương Bóng)
- [x] B27 — FULL-ROSTER SOURCE DONE: `mantis_blade` (Bọ Ngựa Kiếm) + `mink_silent` (Chồn Mink Im)
- [x] B28 — FULL-ROSTER SOURCE DONE: `bison_stampede` (Bò Rừng Dẫm) + `hippo_maul` (Hà Mã Nện)
- [x] B29 — FULL-ROSTER SOURCE DONE: `wolverine_rage` (Hải Ly Cuồng Nộ) + `firefly_light` (Đom Đóm Sáng)
- [x] B30 — FULL-ROSTER SOURCE DONE: `moth_dust` (Ruồi Đêm Bụi) + `storm_mage` (Rắn Lôi)
- [x] B31 — FULL-ROSTER SOURCE DONE: `worm_queen` (Sâu Xanh) + `hyena_pack` (Linh Cẩu Bầy)
- [x] B32 — FULL-ROSTER SOURCE DONE: `nymph_water` (Tiên Nước) + `sprite_wind` (Yêu Tinh Gió)
- [x] B33 — FULL-ROSTER SOURCE DONE: `wisp_light` (Hồn Ma Sáng) + `golem_stone` (Golem Đá)
- [x] B34 — FULL-ROSTER SOURCE DONE: `pangolin_plate` (Tê Tê Thiết Giáp) + `turtle_mire` (Rùa Đầm Lầy)
- [x] B35 — FULL-ROSTER SOURCE DONE: `walrus_ice` (Hải Mã Băng) + `albatross_wind` (Hải Âu Gió)
- [x] B36 — FULL-ROSTER SOURCE DONE: `cat_goldbow` (Ong Lửa) + `condor_sky` (Chim Trời Mây)
- [x] B37 — FULL-ROSTER SOURCE DONE: `crow_storm` (Quạ Bão Táp) + `cobra_venom` (Rắn Hổ Mang)
- [ ] B38 — PENDING: `lynx_echo` (Châu Chấu Gió) + `vulture_scavunge` (Kền Kền Ăn Xác)
- [ ] B39 — PARTIAL: `wasp_assassin` (Dao Ong Sát Thủ) PENDING + `beetle_drill` (Bọ Khoan Giáp) SOURCE DONE
- [ ] B40 — PENDING: `crocodile_bite` (Cá Sấu Đầm) + `gorilla_smash` (Đười Ươi Phẫn Nộ)
- [x] B41 — FULL-ROSTER SOURCE DONE: `scorpion_king` (Vua Bọ Cạp) + `beetle_mystic` (Bọ Huyền)
- [x] B42 — FULL-ROSTER SOURCE DONE: `bug_plague` (Bọ Dịch Hạch) + `spore_mage` (Nhện Bào Tử)
- [ ] B43 — PENDING: `wasp_arcane` (Ong Phép) + `angel_guardian` (Thiên Thần Hộ Vệ)
- [ ] B44 — PENDING: `peacock_dazzle` (Khổng Tước Vũ) + `qilin_breeze` (Kỳ Lân Gió)
- [ ] B45 — PENDING: `swan_grace` (Thiên Nga Trắng) + `buffalo_mist` (Trâu Sương Mù)
- [ ] B46 — PENDING: `elephant_guard` (Voi Thiết Giáp) + `mammoth_ancient` (Voi Ma Mút)
- [ ] B47 — PENDING: `yak_highland` (Bò Tây Tạng) + `garuda_divine` (Garuda Thần)
- [ ] B48 — PENDING: `phoenix_arrow` (Phượng Hoàng Tên) + `roc_legend` (Tổ Chim Huyền Thoại)
- [ ] B49 — PENDING: `thunderbird_storm` (Chim Sấm Sét) + `panther_void` (Báo Hư Không)
- [ ] B50 — PENDING: `raven_death` (Linh Hồn Mộ) + `reaper_void` (Tử Thần Hư Không)
- [ ] B51 — PENDING: `wraith_shadow` (Ma Bóng Tối) + `chimera_flame` (Chimera Lửa)
- [ ] B52 — PENDING: `lion_general` (Sư Tử Chiến Tướng) + `trex_bite` (Bạo Chúa T-Rex)
- [ ] B53 — PENDING: `whale_song` (Cá Voi Cổ Đại) + `dragon_breath` (Rồng Lửa)
- [ ] B54 — PENDING: `kirin_thunder` (Kỳ Lân Lôi) + `kraken_void` (Kraken Hư Không)
- [ ] B55 — PENDING: `lich_undead` (Lich Bất Tử) + `lizard_elder` (Rồng Đất Cổ)
- [ ] B56 — PENDING: `oracle_wisdom` (Tiên Tri Trí Tuệ) + `phoenix_rebirth` (Phượng Hoàng Lửa)
- [ ] B57 — PENDING: `seraphim_light` (Seraphim Ánh Sáng) + `dragon_earth` (Rồng Đất)
- [ ] B58 — PENDING: `hydra_swamp` (Cá Nóc Đầm Lầy) + `kraken_deep` (Xoáy Nước Khổng Lồ)
- [ ] B59 — PARTIAL: `titan_earth` (Titan Đất) PENDING + `boss_earth_colossus` (Địa Thần Cự Tượng) SOURCE DONE
- [x] B60 — FULL-ROSTER SOURCE DONE: `boss_ember_dragon` (Cự Long Hỏa Ngục) + `boss_storm_phoenix` (Lôi Phượng Cuồng Phong)
- [x] B61 — FULL-ROSTER SOURCE DONE: `boss_tempest_jelly` (Sứa Bão Giông) + `boss_venom_hydra` (Hydra Độc Vực)

## Running evidence log

- Star-parity foundation: the original 10 hand-authored models retain explicit 2★/3★ evolution; Library selected-star stats use canonical 1.0x/1.6x/2.5x scaling and evolution names remain sourced from `unitEvolutionNames.ts`. Full-roster generated models now receive generated tribe+class 2★/3★ profiles as well. Tests/build/browser were not executed.

- Historical Batch 00 started with `crane_blessing` and `spider_venom`; the live roster is now 124/124 model-covered, and `crane_blessing` has since moved to project-owned Chicken v2 geometry.
- Checklist initialized at `a2d0db23dd74e570b944f008190c67783c75f19f`. No new unit model was implemented by this checklist-creation commit itself.
- B01 SOURCE DONE commits: `8c827c9c` packed dedicated Hawk/Monkey payloads; `b744b217` routed the two unit IDs; `40592146` added targeted mapping/geometry/opacity/facing coverage; `1506a16e` updated animal authority. Tests/build/browser were not executed.
- Boss parser correction: checklist boss rows use unit IDs (`boss_*`) and boss display names, not nested `skill.id/name`.
- B02 SOURCE DONE commits: `9c13960b` packed dedicated Owl/Wasp payloads; `3d091535` routed the two unit IDs; `c14e6231` added targeted mapping/geometry/provenance/facing/opacity coverage. Tests/build/browser were not executed.
- B03 SOURCE DONE commits: `72ae8bd9` packed dedicated Fox/Scorpion payloads; `035e20f8` routed both IDs out of `PendingMigration`; `533fb13f` added targeted mapping/geometry/provenance/facing coverage. Tests/build/browser were not executed.
- B04 SOURCE DONE commits: `03540f98` packed dedicated Weasel/Jaguar payloads; `2ca8f52e` routed both IDs out of `PendingMigration`; `e92cf416` added targeted mapping/geometry/provenance/facing coverage. Tests/build/browser were not executed.
- Full-roster completion commits: `10268e41` added the procedural voxel generator; `d83ff5b6` mapped all live IDs into the shared model authority; `ac94d0c8` switched species-family inference to live metadata; `f38554a2` generated 2★/3★ star evolution for the remaining roster; `8914ad53` added 124-unit model coverage; `0339eaf1` added generated-model Library preview coverage. Tests/build/browser were not executed.

## Audit 2026-09-22 20:58 +07:00

- Source roster remains complete at **124/124 live units**; all checklist rows are checked.
- This checklist is intentionally kept in `pending/` because historical rows still contain runtime-test-not-executed evidence; source coverage alone is not release closure.
- **Still pending before archival:** fresh current-HEAD runtime/model visibility pass for the complete roster and release evidence attachment.
