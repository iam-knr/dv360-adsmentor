# components/youtube

Session P4-06. Spec: `docs/specs/modules/09-youtube.md`.

- `AdGroupsTab` the Ad groups tab: grid, bulk Activate and Pause, `?sim_panel=adgroup:{id}` and `ad:{id}&adgroup={id}`
- `AdGroupPanel` the ad group slide-over (name, targeting card, bid, ads of the group)
- `AdPanel` the ad slide-over with the live `AdPreview`
- `AdPreview`, `DvVideoMock` the preview pane and the static mock player
- `YtStep1` new line item step 1 (optimization and ad format)
- `YoutubeLiSections` the YouTube sections that `components/line-items/LiForm` renders for `YT_VIDEO` and `YT_AUDIO`
