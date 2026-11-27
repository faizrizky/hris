// Colour of the selected sidebar and dock items: applied from boot.hris_menu_color and chosen in Settings > Appearance as cards,
// next to Frappe's own Theme/Layout/Dock cards. css/menu_color.css paints the item. See sentra_ats/menu_color.py.
frappe.provide("sentra_ats.menu_color");

Object.assign(sentra_ats.menu_color, {
	BLUE: "#467cf7",

	// Empty (the default) keeps ERPNext's own look; only a stored colour repaints the selected items.
	resolve(value) {
		return /^#[0-9a-f]{6}$/i.test(value || "") ? value : null;
	},

	// Dark text on light colours, white text on dark ones.
	ink(color) {
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
		return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#171717" : "#ffffff";
	},

	apply(value) {
		const root = document.documentElement;
		const color = this.resolve(value);
		root.classList.toggle("hris-menu-color", Boolean(color));
		if (!color) return;
		root.style.setProperty("--hris-menu-bg", color);
		root.style.setProperty("--hris-menu-ink", this.ink(color));
	},

	save(value) {
		const previous = frappe.boot.hris_menu_color;
		frappe.boot.hris_menu_color = value;
		this.apply(value);
		return frappe.db.set_value("User", frappe.session.user, "custom_menu_color", value).then(
			() => frappe.show_alert({ message: __("Saved"), indicator: "green" }),
			() => {
				frappe.boot.hris_menu_color = previous;
				this.apply(previous);
			}
		);
	},

	// A theme-card like the ones above it, with a miniature sidebar showing the selected item.
	card(label, color, extra = "") {
		const item = color ? `style="background:${color}"` : "";
		return $(`
			<div class="theme-card-wrapper">
				<button type="button" class="theme-card">
					<div class="theme-card-preview hris-color-preview">
						<span class="hris-color-row"></span>
						<span class="hris-color-row ${color ? "hris-color-selected" : "hris-color-plain"}" ${item}></span>
						<span class="hris-color-row"></span>
						${extra}
					</div>
					<div class="theme-card-footer">
						<span class="theme-card-label">${frappe.utils.escape_html(label)}</span>
						<span class="theme-card-radio"></span>
					</div>
				</button>
			</div>
		`);
	},

	render(panel) {
		const presets = [
			["", __("Default"), null],
			[this.BLUE, __("Blue"), this.BLUE],
			["#16a34a", __("Green"), "#16a34a"],
			["#7c3aed", __("Purple"), "#7c3aed"],
			["#ea580c", __("Orange"), "#ea580c"],
		];
		const current = (this.resolve(frappe.boot.hris_menu_color) || "").toLowerCase();
		const is_preset = presets.some(([value]) => value === current);
		const $grid = $(`<div class="hris-color-cards"></div>`);
		const select = ($card) => {
			$grid.find(".theme-card-wrapper").removeClass("selected");
			$card.addClass("selected");
		};

		presets.forEach(([value, label, color]) => {
			const $card = this.card(label, color).toggleClass("selected", value === current);
			$card.on("click", () => {
				select($card);
				this.save(value);
			});
			$grid.append($card);
		});

		const custom = is_preset ? this.BLUE : current;
		const $custom = this.card(__("Custom"), custom).toggleClass("selected", !is_preset);
		const $field = $(`<div class="hris-color-field"></div>`).toggleClass("hide", is_preset);
		$custom.on("click", () => {
			select($custom);
			$field.removeClass("hide");
			this.save(control.get_color() || this.BLUE);
		});
		$grid.append($custom);
		$grid.on("click", ".theme-card-wrapper", (event) => {
			if (event.currentTarget !== $custom[0]) $field.addClass("hide");
		});

		panel.body.append(
			$(`<div class="hris-color-heading">
				<div class="hris-color-title">${__("Menu Color")}</div>
				<div class="text-muted">${__("Choose the color of the selected menu item.")}</div>
			</div>`),
			$grid,
			$field
		);

		// Frappe's own Color field (swatches and picker), so choosing a colour looks like the rest of the desk.
		const control = frappe.ui.form.make_control({
			parent: $field,
			df: { fieldtype: "Color", fieldname: "menu_color", label: __("Custom color") },
			render_input: true,
		});
		control.set_input(custom);
		// The picker reports every step of a drag: paint at once, store when it settles.
		const store = frappe.utils.debounce((value) => this.save(value), 600);
		control.df.change = () => {
			const value = control.get_color();
			if (!value || value.toLowerCase() === (frappe.boot.hris_menu_color || "").toLowerCase()) return;
			select($custom);
			$custom.find(".hris-color-selected").css("background", value);
			this.apply(value);
			store(value);
		};
	},

	// Frappe has no hook for the Appearance tab, so the lazily loaded settings dialog class is extended once.
	extend_settings_dialog() {
		const Base = frappe.ui.SettingsDialog;
		if (!Base || Base.hris_menu_color) return;
		frappe.ui.SettingsDialog = class extends Base {
			static hris_menu_color = true;
			constructor(options) {
				(options.tabs || [])
					.flatMap((group) => group.items || [])
					.filter((tab) => tab.id === "appearance")
					.forEach((tab) => {
						const render = tab.render;
						tab.render = (panel) => {
							render?.(panel);
							sentra_ats.menu_color.render(panel);
						};
					});
				super(options);
			}
		};
	},
});

$(document).on("app_ready", () => {
	sentra_ats.menu_color.apply(frappe.boot.hris_menu_color);
	frappe.require("user_settings_dialog.bundle.js").then(() => sentra_ats.menu_color.extend_settings_dialog());
});
