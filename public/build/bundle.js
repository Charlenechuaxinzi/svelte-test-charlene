
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback, value) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            if (value === undefined) {
                callback(component.$$.ctx[index]);
            }
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* node_modules/@sveltejs/svelte-scroller/Scroller.svelte generated by Svelte v3.55.0 */

    const { window: window_1 } = globals;
    const file = "node_modules/@sveltejs/svelte-scroller/Scroller.svelte";
    const get_foreground_slot_changes = dirty => ({});
    const get_foreground_slot_context = ctx => ({});
    const get_background_slot_changes = dirty => ({});
    const get_background_slot_context = ctx => ({});

    function create_fragment(ctx) {
    	let svelte_scroller_outer;
    	let svelte_scroller_background_container;
    	let svelte_scroller_background;
    	let svelte_scroller_background_container_style_value;
    	let t;
    	let svelte_scroller_foreground;
    	let current;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[21]);
    	const background_slot_template = /*#slots*/ ctx[20].background;
    	const background_slot = create_slot(background_slot_template, ctx, /*$$scope*/ ctx[19], get_background_slot_context);
    	const foreground_slot_template = /*#slots*/ ctx[20].foreground;
    	const foreground_slot = create_slot(foreground_slot_template, ctx, /*$$scope*/ ctx[19], get_foreground_slot_context);

    	const block = {
    		c: function create() {
    			svelte_scroller_outer = element("svelte-scroller-outer");
    			svelte_scroller_background_container = element("svelte-scroller-background-container");
    			svelte_scroller_background = element("svelte-scroller-background");
    			if (background_slot) background_slot.c();
    			t = space();
    			svelte_scroller_foreground = element("svelte-scroller-foreground");
    			if (foreground_slot) foreground_slot.c();
    			set_custom_element_data(svelte_scroller_background, "class", "svelte-xdbafy");
    			add_location(svelte_scroller_background, file, 173, 2, 3978);
    			set_custom_element_data(svelte_scroller_background_container, "class", "background-container svelte-xdbafy");
    			set_custom_element_data(svelte_scroller_background_container, "style", svelte_scroller_background_container_style_value = "" + (/*style*/ ctx[5] + /*widthStyle*/ ctx[4]));
    			add_location(svelte_scroller_background_container, file, 172, 1, 3880);
    			set_custom_element_data(svelte_scroller_foreground, "class", "svelte-xdbafy");
    			add_location(svelte_scroller_foreground, file, 178, 1, 4140);
    			set_custom_element_data(svelte_scroller_outer, "class", "svelte-xdbafy");
    			add_location(svelte_scroller_outer, file, 171, 0, 3837);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svelte_scroller_outer, anchor);
    			append_dev(svelte_scroller_outer, svelte_scroller_background_container);
    			append_dev(svelte_scroller_background_container, svelte_scroller_background);

    			if (background_slot) {
    				background_slot.m(svelte_scroller_background, null);
    			}

    			/*svelte_scroller_background_binding*/ ctx[22](svelte_scroller_background);
    			append_dev(svelte_scroller_outer, t);
    			append_dev(svelte_scroller_outer, svelte_scroller_foreground);

    			if (foreground_slot) {
    				foreground_slot.m(svelte_scroller_foreground, null);
    			}

    			/*svelte_scroller_foreground_binding*/ ctx[23](svelte_scroller_foreground);
    			/*svelte_scroller_outer_binding*/ ctx[24](svelte_scroller_outer);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window_1, "resize", /*onwindowresize*/ ctx[21]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (background_slot) {
    				if (background_slot.p && (!current || dirty[0] & /*$$scope*/ 524288)) {
    					update_slot_base(
    						background_slot,
    						background_slot_template,
    						ctx,
    						/*$$scope*/ ctx[19],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[19])
    						: get_slot_changes(background_slot_template, /*$$scope*/ ctx[19], dirty, get_background_slot_changes),
    						get_background_slot_context
    					);
    				}
    			}

    			if (!current || dirty[0] & /*style, widthStyle*/ 48 && svelte_scroller_background_container_style_value !== (svelte_scroller_background_container_style_value = "" + (/*style*/ ctx[5] + /*widthStyle*/ ctx[4]))) {
    				set_custom_element_data(svelte_scroller_background_container, "style", svelte_scroller_background_container_style_value);
    			}

    			if (foreground_slot) {
    				if (foreground_slot.p && (!current || dirty[0] & /*$$scope*/ 524288)) {
    					update_slot_base(
    						foreground_slot,
    						foreground_slot_template,
    						ctx,
    						/*$$scope*/ ctx[19],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[19])
    						: get_slot_changes(foreground_slot_template, /*$$scope*/ ctx[19], dirty, get_foreground_slot_changes),
    						get_foreground_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(background_slot, local);
    			transition_in(foreground_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(background_slot, local);
    			transition_out(foreground_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svelte_scroller_outer);
    			if (background_slot) background_slot.d(detaching);
    			/*svelte_scroller_background_binding*/ ctx[22](null);
    			if (foreground_slot) foreground_slot.d(detaching);
    			/*svelte_scroller_foreground_binding*/ ctx[23](null);
    			/*svelte_scroller_outer_binding*/ ctx[24](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const handlers = [];
    let manager;

    if (typeof window !== 'undefined') {
    	const run_all = () => handlers.forEach(fn => fn());
    	window.addEventListener('scroll', run_all);
    	window.addEventListener('resize', run_all);
    }

    if (typeof IntersectionObserver !== 'undefined') {
    	const map = new Map();

    	const observer = new IntersectionObserver((entries, observer) => {
    			entries.forEach(entry => {
    				const update = map.get(entry.target);
    				const index = handlers.indexOf(update);

    				if (entry.isIntersecting) {
    					if (index === -1) handlers.push(update);
    				} else {
    					update();
    					if (index !== -1) handlers.splice(index, 1);
    				}
    			});
    		},
    	{
    			rootMargin: '400px 0px', // TODO why 400?
    			
    		});

    	manager = {
    		add: ({ outer, update }) => {
    			const { top, bottom } = outer.getBoundingClientRect();
    			if (top < window.innerHeight && bottom > 0) handlers.push(update);
    			map.set(outer, update);
    			observer.observe(outer);
    		},
    		remove: ({ outer, update }) => {
    			const index = handlers.indexOf(update);
    			if (index !== -1) handlers.splice(index, 1);
    			map.delete(outer);
    			observer.unobserve(outer);
    		}
    	};
    } else {
    	manager = {
    		add: ({ update }) => {
    			handlers.push(update);
    		},
    		remove: ({ update }) => {
    			const index = handlers.indexOf(update);
    			if (index !== -1) handlers.splice(index, 1);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let top_px;
    	let bottom_px;
    	let threshold_px;
    	let style;
    	let widthStyle;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Scroller', slots, ['background','foreground']);
    	let { top = 0 } = $$props;
    	let { bottom = 1 } = $$props;
    	let { threshold = 0.5 } = $$props;
    	let { query = 'section' } = $$props;
    	let { parallax = false } = $$props;
    	let { index = 0 } = $$props;
    	let { count = 0 } = $$props;
    	let { offset = 0 } = $$props;
    	let { progress = 0 } = $$props;
    	let { visible = false } = $$props;
    	let outer;
    	let foreground;
    	let background;
    	let left;
    	let sections;
    	let wh = 0;
    	let fixed;
    	let offset_top = 0;
    	let width = 1;
    	let height;
    	let inverted;

    	onMount(() => {
    		sections = foreground.querySelectorAll(query);
    		$$invalidate(7, count = sections.length);
    		update();
    		const scroller = { outer, update };
    		manager.add(scroller);
    		return () => manager.remove(scroller);
    	});

    	function update() {
    		if (!foreground) return;

    		// re-measure outer container
    		const bcr = outer.getBoundingClientRect();

    		left = bcr.left;
    		$$invalidate(18, width = bcr.right - left);

    		// determine fix state
    		const fg = foreground.getBoundingClientRect();

    		const bg = background.getBoundingClientRect();
    		$$invalidate(10, visible = fg.top < wh && fg.bottom > 0);
    		const foreground_height = fg.bottom - fg.top;
    		const background_height = bg.bottom - bg.top;
    		const available_space = bottom_px - top_px;
    		$$invalidate(9, progress = (top_px - fg.top) / (foreground_height - available_space));

    		if (progress <= 0) {
    			$$invalidate(17, offset_top = 0);
    			$$invalidate(16, fixed = false);
    		} else if (progress >= 1) {
    			$$invalidate(17, offset_top = parallax
    			? foreground_height - background_height
    			: foreground_height - available_space);

    			$$invalidate(16, fixed = false);
    		} else {
    			$$invalidate(17, offset_top = parallax
    			? Math.round(top_px - progress * (background_height - available_space))
    			: top_px);

    			$$invalidate(16, fixed = true);
    		}

    		for (let i = 0; i < sections.length; i++) {
    			const section = sections[i];
    			const { top } = section.getBoundingClientRect();
    			const next = sections[i + 1];
    			const bottom = next ? next.getBoundingClientRect().top : fg.bottom;
    			$$invalidate(8, offset = (threshold_px - top) / (bottom - top));

    			if (bottom >= threshold_px) {
    				$$invalidate(6, index = i);
    				break;
    			}
    		}
    	}

    	const writable_props = [
    		'top',
    		'bottom',
    		'threshold',
    		'query',
    		'parallax',
    		'index',
    		'count',
    		'offset',
    		'progress',
    		'visible'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Scroller> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(0, wh = window_1.innerHeight);
    	}

    	function svelte_scroller_background_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			background = $$value;
    			$$invalidate(3, background);
    		});
    	}

    	function svelte_scroller_foreground_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			foreground = $$value;
    			$$invalidate(2, foreground);
    		});
    	}

    	function svelte_scroller_outer_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			outer = $$value;
    			$$invalidate(1, outer);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('top' in $$props) $$invalidate(11, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(12, bottom = $$props.bottom);
    		if ('threshold' in $$props) $$invalidate(13, threshold = $$props.threshold);
    		if ('query' in $$props) $$invalidate(14, query = $$props.query);
    		if ('parallax' in $$props) $$invalidate(15, parallax = $$props.parallax);
    		if ('index' in $$props) $$invalidate(6, index = $$props.index);
    		if ('count' in $$props) $$invalidate(7, count = $$props.count);
    		if ('offset' in $$props) $$invalidate(8, offset = $$props.offset);
    		if ('progress' in $$props) $$invalidate(9, progress = $$props.progress);
    		if ('visible' in $$props) $$invalidate(10, visible = $$props.visible);
    		if ('$$scope' in $$props) $$invalidate(19, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		handlers,
    		manager,
    		onMount,
    		top,
    		bottom,
    		threshold,
    		query,
    		parallax,
    		index,
    		count,
    		offset,
    		progress,
    		visible,
    		outer,
    		foreground,
    		background,
    		left,
    		sections,
    		wh,
    		fixed,
    		offset_top,
    		width,
    		height,
    		inverted,
    		update,
    		threshold_px,
    		top_px,
    		bottom_px,
    		widthStyle,
    		style
    	});

    	$$self.$inject_state = $$props => {
    		if ('top' in $$props) $$invalidate(11, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(12, bottom = $$props.bottom);
    		if ('threshold' in $$props) $$invalidate(13, threshold = $$props.threshold);
    		if ('query' in $$props) $$invalidate(14, query = $$props.query);
    		if ('parallax' in $$props) $$invalidate(15, parallax = $$props.parallax);
    		if ('index' in $$props) $$invalidate(6, index = $$props.index);
    		if ('count' in $$props) $$invalidate(7, count = $$props.count);
    		if ('offset' in $$props) $$invalidate(8, offset = $$props.offset);
    		if ('progress' in $$props) $$invalidate(9, progress = $$props.progress);
    		if ('visible' in $$props) $$invalidate(10, visible = $$props.visible);
    		if ('outer' in $$props) $$invalidate(1, outer = $$props.outer);
    		if ('foreground' in $$props) $$invalidate(2, foreground = $$props.foreground);
    		if ('background' in $$props) $$invalidate(3, background = $$props.background);
    		if ('left' in $$props) left = $$props.left;
    		if ('sections' in $$props) sections = $$props.sections;
    		if ('wh' in $$props) $$invalidate(0, wh = $$props.wh);
    		if ('fixed' in $$props) $$invalidate(16, fixed = $$props.fixed);
    		if ('offset_top' in $$props) $$invalidate(17, offset_top = $$props.offset_top);
    		if ('width' in $$props) $$invalidate(18, width = $$props.width);
    		if ('height' in $$props) height = $$props.height;
    		if ('inverted' in $$props) $$invalidate(31, inverted = $$props.inverted);
    		if ('threshold_px' in $$props) threshold_px = $$props.threshold_px;
    		if ('top_px' in $$props) top_px = $$props.top_px;
    		if ('bottom_px' in $$props) bottom_px = $$props.bottom_px;
    		if ('widthStyle' in $$props) $$invalidate(4, widthStyle = $$props.widthStyle);
    		if ('style' in $$props) $$invalidate(5, style = $$props.style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*top, wh*/ 2049) {
    			 top_px = Math.round(top * wh);
    		}

    		if ($$self.$$.dirty[0] & /*bottom, wh*/ 4097) {
    			 bottom_px = Math.round(bottom * wh);
    		}

    		if ($$self.$$.dirty[0] & /*threshold, wh*/ 8193) {
    			 threshold_px = Math.round(threshold * wh);
    		}

    		if ($$self.$$.dirty[0] & /*top, bottom, threshold, parallax*/ 47104) {
    			 (update());
    		}

    		if ($$self.$$.dirty[0] & /*fixed, offset_top*/ 196608) {
    			 $$invalidate(5, style = `
		position: ${fixed ? 'fixed' : 'absolute'};
		top: 0;
		transform: translate(0, ${offset_top}px);
		z-index: ${inverted ? 3 : 1};
	`);
    		}

    		if ($$self.$$.dirty[0] & /*fixed, width*/ 327680) {
    			 $$invalidate(4, widthStyle = fixed ? `width:${width}px;` : '');
    		}
    	};

    	return [
    		wh,
    		outer,
    		foreground,
    		background,
    		widthStyle,
    		style,
    		index,
    		count,
    		offset,
    		progress,
    		visible,
    		top,
    		bottom,
    		threshold,
    		query,
    		parallax,
    		fixed,
    		offset_top,
    		width,
    		$$scope,
    		slots,
    		onwindowresize,
    		svelte_scroller_background_binding,
    		svelte_scroller_foreground_binding,
    		svelte_scroller_outer_binding
    	];
    }

    class Scroller extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				top: 11,
    				bottom: 12,
    				threshold: 13,
    				query: 14,
    				parallax: 15,
    				index: 6,
    				count: 7,
    				offset: 8,
    				progress: 9,
    				visible: 10
    			},
    			null,
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Scroller",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get top() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set top(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bottom() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bottom(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get threshold() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set threshold(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get query() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set query(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get parallax() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set parallax(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get index() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set index(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get count() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set count(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get offset() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set offset(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get progress() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set progress(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get visible() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set visible(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.55.0 */
    const file$1 = "src/App.svelte";

    // (30:6) {#if index === 1}
    function create_if_block_13(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			add_location(div, file$1, 30, 8, 486);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(30:6) {#if index === 1}",
    		ctx
    	});

    	return block;
    }

    // (33:6) {#if index === 2}
    function create_if_block_12(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/map.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 34, 8, 565);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 33, 3, 533);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(33:6) {#if index === 2}",
    		ctx
    	});

    	return block;
    }

    // (42:6) {#if index === 3}
    function create_if_block_11(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/miles-driven.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 43, 10, 740);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 42, 8, 706);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(42:6) {#if index === 3}",
    		ctx
    	});

    	return block;
    }

    // (51:6) {#if index === 4}
    function create_if_block_10(ctx) {
    	let div;
    	let video;
    	let source;
    	let source_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			video = element("video");
    			source = element("source");
    			if (!src_url_equal(source.src, source_src_value = "./img/wine-tastings.mp4")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			add_location(source, file$1, 57, 12, 1018);
    			video.controls = true;
    			video.autoplay = true;
    			attr_dev(video, "class", "video svelte-hvbjli");
    			add_location(video, file$1, 52, 10, 928);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 51, 8, 894);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, video);
    			append_dev(video, source);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(51:6) {#if index === 4}",
    		ctx
    	});

    	return block;
    }

    // (62:6) {#if index === 5}
    function create_if_block_9(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/pies.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 63, 10, 1188);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 62, 8, 1154);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(62:6) {#if index === 5}",
    		ctx
    	});

    	return block;
    }

    // (71:6) {#if index === 6}
    function create_if_block_8(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/ham-and-cheese.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 72, 10, 1368);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 71, 8, 1334);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(71:6) {#if index === 6}",
    		ctx
    	});

    	return block;
    }

    // (80:6) {#if index === 7}
    function create_if_block_7(ctx) {
    	let div;
    	let video;
    	let source;
    	let source_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			video = element("video");
    			source = element("source");
    			if (!src_url_equal(source.src, source_src_value = "./img/meltdowns.mp4")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			add_location(source, file$1, 86, 12, 1641);
    			video.controls = true;
    			video.autoplay = true;
    			attr_dev(video, "class", "video svelte-hvbjli");
    			add_location(video, file$1, 81, 3, 1551);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 80, 8, 1524);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, video);
    			append_dev(video, source);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(80:6) {#if index === 7}",
    		ctx
    	});

    	return block;
    }

    // (91:6) {#if index === 8}
    function create_if_block_6(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/spin.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 92, 10, 1807);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 91, 8, 1773);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(91:6) {#if index === 8}",
    		ctx
    	});

    	return block;
    }

    // (100:6) {#if index === 9}
    function create_if_block_5(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/david-test.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 101, 10, 1987);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 100, 8, 1953);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(100:6) {#if index === 9}",
    		ctx
    	});

    	return block;
    }

    // (109:6) {#if index === 10}
    function create_if_block_4(ctx) {
    	let div;
    	let video;
    	let source;
    	let source_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			video = element("video");
    			source = element("source");
    			if (!src_url_equal(source.src, source_src_value = "./img/cows.mp4")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			add_location(source, file$1, 115, 12, 2257);
    			video.controls = true;
    			video.autoplay = true;
    			attr_dev(video, "class", "video svelte-hvbjli");
    			add_location(video, file$1, 110, 3, 2167);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 109, 8, 2140);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, video);
    			append_dev(video, source);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(109:6) {#if index === 10}",
    		ctx
    	});

    	return block;
    }

    // (120:6) {#if index === 11}
    function create_if_block_3(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/meals.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 121, 10, 2419);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 120, 8, 2385);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(120:6) {#if index === 11}",
    		ctx
    	});

    	return block;
    }

    // (129:6) {#if index === 12}
    function create_if_block_2(ctx) {
    	let div;
    	let video;
    	let source;
    	let source_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			video = element("video");
    			source = element("source");
    			if (!src_url_equal(source.src, source_src_value = "./img/avocado.mp4")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			add_location(source, file$1, 135, 12, 2691);
    			video.controls = true;
    			video.autoplay = true;
    			attr_dev(video, "class", "video svelte-hvbjli");
    			add_location(video, file$1, 130, 10, 2601);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 129, 8, 2567);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, video);
    			append_dev(video, source);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(129:6) {#if index === 12}",
    		ctx
    	});

    	return block;
    }

    // (140:3) {#if index === 13}
    function create_if_block_1(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/tas.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 141, 2, 2840);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 140, 3, 2814);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(140:3) {#if index === 13}",
    		ctx
    	});

    	return block;
    }

    // (149:1) {#if index === 14}
    function create_if_block(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./img/melb.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image svelte-hvbjli");
    			add_location(img, file$1, 150, 3, 2968);
    			attr_dev(div, "class", "container svelte-hvbjli");
    			add_location(div, file$1, 149, 1, 2941);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(149:1) {#if index === 14}",
    		ctx
    	});

    	return block;
    }

    // (29:4) 
    function create_background_slot(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let if_block0 = /*index*/ ctx[1] === 1 && create_if_block_13(ctx);
    	let if_block1 = /*index*/ ctx[1] === 2 && create_if_block_12(ctx);
    	let if_block2 = /*index*/ ctx[1] === 3 && create_if_block_11(ctx);
    	let if_block3 = /*index*/ ctx[1] === 4 && create_if_block_10(ctx);
    	let if_block4 = /*index*/ ctx[1] === 5 && create_if_block_9(ctx);
    	let if_block5 = /*index*/ ctx[1] === 6 && create_if_block_8(ctx);
    	let if_block6 = /*index*/ ctx[1] === 7 && create_if_block_7(ctx);
    	let if_block7 = /*index*/ ctx[1] === 8 && create_if_block_6(ctx);
    	let if_block8 = /*index*/ ctx[1] === 9 && create_if_block_5(ctx);
    	let if_block9 = /*index*/ ctx[1] === 10 && create_if_block_4(ctx);
    	let if_block10 = /*index*/ ctx[1] === 11 && create_if_block_3(ctx);
    	let if_block11 = /*index*/ ctx[1] === 12 && create_if_block_2(ctx);
    	let if_block12 = /*index*/ ctx[1] === 13 && create_if_block_1(ctx);
    	let if_block13 = /*index*/ ctx[1] === 14 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			t3 = space();
    			if (if_block4) if_block4.c();
    			t4 = space();
    			if (if_block5) if_block5.c();
    			t5 = space();
    			if (if_block6) if_block6.c();
    			t6 = space();
    			if (if_block7) if_block7.c();
    			t7 = space();
    			if (if_block8) if_block8.c();
    			t8 = space();
    			if (if_block9) if_block9.c();
    			t9 = space();
    			if (if_block10) if_block10.c();
    			t10 = space();
    			if (if_block11) if_block11.c();
    			t11 = space();
    			if (if_block12) if_block12.c();
    			t12 = space();
    			if (if_block13) if_block13.c();
    			attr_dev(div, "slot", "background");
    			add_location(div, file$1, 28, 4, 430);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t0);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t1);
    			if (if_block2) if_block2.m(div, null);
    			append_dev(div, t2);
    			if (if_block3) if_block3.m(div, null);
    			append_dev(div, t3);
    			if (if_block4) if_block4.m(div, null);
    			append_dev(div, t4);
    			if (if_block5) if_block5.m(div, null);
    			append_dev(div, t5);
    			if (if_block6) if_block6.m(div, null);
    			append_dev(div, t6);
    			if (if_block7) if_block7.m(div, null);
    			append_dev(div, t7);
    			if (if_block8) if_block8.m(div, null);
    			append_dev(div, t8);
    			if (if_block9) if_block9.m(div, null);
    			append_dev(div, t9);
    			if (if_block10) if_block10.m(div, null);
    			append_dev(div, t10);
    			if (if_block11) if_block11.m(div, null);
    			append_dev(div, t11);
    			if (if_block12) if_block12.m(div, null);
    			append_dev(div, t12);
    			if (if_block13) if_block13.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (/*index*/ ctx[1] === 1) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_13(ctx);
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*index*/ ctx[1] === 2) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_12(ctx);
    					if_block1.c();
    					if_block1.m(div, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*index*/ ctx[1] === 3) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_11(ctx);
    					if_block2.c();
    					if_block2.m(div, t2);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*index*/ ctx[1] === 4) {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_10(ctx);
    					if_block3.c();
    					if_block3.m(div, t3);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*index*/ ctx[1] === 5) {
    				if (if_block4) ; else {
    					if_block4 = create_if_block_9(ctx);
    					if_block4.c();
    					if_block4.m(div, t4);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*index*/ ctx[1] === 6) {
    				if (if_block5) ; else {
    					if_block5 = create_if_block_8(ctx);
    					if_block5.c();
    					if_block5.m(div, t5);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*index*/ ctx[1] === 7) {
    				if (if_block6) ; else {
    					if_block6 = create_if_block_7(ctx);
    					if_block6.c();
    					if_block6.m(div, t6);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if (/*index*/ ctx[1] === 8) {
    				if (if_block7) ; else {
    					if_block7 = create_if_block_6(ctx);
    					if_block7.c();
    					if_block7.m(div, t7);
    				}
    			} else if (if_block7) {
    				if_block7.d(1);
    				if_block7 = null;
    			}

    			if (/*index*/ ctx[1] === 9) {
    				if (if_block8) ; else {
    					if_block8 = create_if_block_5(ctx);
    					if_block8.c();
    					if_block8.m(div, t8);
    				}
    			} else if (if_block8) {
    				if_block8.d(1);
    				if_block8 = null;
    			}

    			if (/*index*/ ctx[1] === 10) {
    				if (if_block9) ; else {
    					if_block9 = create_if_block_4(ctx);
    					if_block9.c();
    					if_block9.m(div, t9);
    				}
    			} else if (if_block9) {
    				if_block9.d(1);
    				if_block9 = null;
    			}

    			if (/*index*/ ctx[1] === 11) {
    				if (if_block10) ; else {
    					if_block10 = create_if_block_3(ctx);
    					if_block10.c();
    					if_block10.m(div, t10);
    				}
    			} else if (if_block10) {
    				if_block10.d(1);
    				if_block10 = null;
    			}

    			if (/*index*/ ctx[1] === 12) {
    				if (if_block11) ; else {
    					if_block11 = create_if_block_2(ctx);
    					if_block11.c();
    					if_block11.m(div, t11);
    				}
    			} else if (if_block11) {
    				if_block11.d(1);
    				if_block11 = null;
    			}

    			if (/*index*/ ctx[1] === 13) {
    				if (if_block12) ; else {
    					if_block12 = create_if_block_1(ctx);
    					if_block12.c();
    					if_block12.m(div, t12);
    				}
    			} else if (if_block12) {
    				if_block12.d(1);
    				if_block12 = null;
    			}

    			if (/*index*/ ctx[1] === 14) {
    				if (if_block13) ; else {
    					if_block13 = create_if_block(ctx);
    					if_block13.c();
    					if_block13.m(div, null);
    				}
    			} else if (if_block13) {
    				if_block13.d(1);
    				if_block13 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    			if (if_block7) if_block7.d();
    			if (if_block8) if_block8.d();
    			if (if_block9) if_block9.d();
    			if (if_block10) if_block10.d();
    			if (if_block11) if_block11.d();
    			if (if_block12) if_block12.d();
    			if (if_block13) if_block13.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_background_slot.name,
    		type: "slot",
    		source: "(29:4) ",
    		ctx
    	});

    	return block;
    }

    // (160:4) 
    function create_foreground_slot(ctx) {
    	let div14;
    	let section0;
    	let div0;
    	let p0;
    	let t0;
    	let b0;
    	let t2;
    	let br0;
    	let t3;
    	let i;
    	let br1;
    	let t5;
    	let br2;
    	let t6;
    	let t7;
    	let section1;
    	let div1;
    	let p1;
    	let t9;
    	let section2;
    	let div2;
    	let p2;
    	let t10;
    	let br3;
    	let t11;
    	let t12;
    	let section3;
    	let div3;
    	let p3;
    	let b1;
    	let br4;
    	let t14;
    	let br5;
    	let t15;
    	let br6;
    	let t16;
    	let br7;
    	let t17;
    	let br8;
    	let t18;
    	let section4;
    	let div4;
    	let p4;
    	let b2;
    	let br9;
    	let t20;
    	let br10;
    	let t21;
    	let br11;
    	let t22;
    	let br12;
    	let t23;
    	let t24;
    	let section5;
    	let div5;
    	let p5;
    	let t26;
    	let section6;
    	let div6;
    	let p6;
    	let t28;
    	let section7;
    	let div7;
    	let p7;
    	let t29;
    	let br13;
    	let t30;
    	let t31;
    	let section8;
    	let div8;
    	let p8;
    	let t32;
    	let br14;
    	let t33;
    	let t34;
    	let section9;
    	let div9;
    	let p9;
    	let t35;
    	let br15;
    	let t36;
    	let br16;
    	let t37;
    	let t38;
    	let section10;
    	let div10;
    	let p10;
    	let t40;
    	let section11;
    	let div11;
    	let p11;
    	let t41;
    	let br17;
    	let t42;
    	let t43;
    	let section12;
    	let div12;
    	let p12;
    	let t44;
    	let br18;
    	let t45;
    	let t46;
    	let section13;
    	let div13;
    	let p13;
    	let t47;
    	let b3;
    	let t49;
    	let section14;

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			section0 = element("section");
    			div0 = element("div");
    			p0 = element("p");
    			t0 = text("London but now ");
    			b0 = element("b");
    			b0.textContent = "Aussie 2023";
    			t2 = text(" 🇦🇺,");
    			br0 = element("br");
    			t3 = space();
    			i = element("i");
    			i.textContent = "in numbers (and maps)";
    			br1 = element("br");
    			t5 = space();
    			br2 = element("br");
    			t6 = text("\n            Scroll to continue");
    			t7 = space();
    			section1 = element("section");
    			div1 = element("div");
    			p1 = element("p");
    			p1.textContent = "Cities: 4";
    			t9 = space();
    			section2 = element("section");
    			div2 = element("div");
    			p2 = element("p");
    			t10 = text("Distance driven: 3120.7km");
    			br3 = element("br");
    			t11 = text("\n            (It's also 16.2 times the coast of 🇸🇬)");
    			t12 = space();
    			section3 = element("section");
    			div3 = element("div");
    			p3 = element("p");
    			b1 = element("b");
    			b1.textContent = "Wine tastings: 🍷🍷🍷 ";
    			br4 = element("br");
    			t14 = space();
    			br5 = element("br");
    			t15 = text("\n\t\t\t• Cabbage hill: the one I want to get married in");
    			br6 = element("br");
    			t16 = text("\n\t\t\t• Tamar Valley: where you almost sold the dude Hougang");
    			br7 = element("br");
    			t17 = text("\n\t\t\t• Innocent Bystander: where we went home with 6 bottles and ate paella");
    			br8 = element("br");
    			t18 = space();
    			section4 = element("section");
    			div4 = element("div");
    			p4 = element("p");
    			b2 = element("b");
    			b2.textContent = "Pies 🥧";
    			br9 = element("br");
    			t20 = text("\n            Total pies: 27");
    			br10 = element("br");
    			t21 = text("\n            Shared pies: 7");
    			br11 = element("br");
    			t22 = text("\n            Char: 11 whole pies");
    			br12 = element("br");
    			t23 = text("\n            Freda: 9 whole pies");
    			t24 = space();
    			section5 = element("section");
    			div5 = element("div");
    			p5 = element("p");
    			p5.textContent = "Ham & cheese croissants: I FORGOT SIS, but MANY.";
    			t26 = space();
    			section6 = element("section");
    			div6 = element("div");
    			p6 = element("p");
    			p6.textContent = "Mental breakdowns: 404 ERROR";
    			t28 = space();
    			section7 = element("section");
    			div7 = element("div");
    			p7 = element("p");
    			t29 = text("AMAZING spin classes: 9");
    			br13 = element("br");
    			t30 = text("\n            Bad spin classes: 1");
    			t31 = space();
    			section8 = element("section");
    			div8 = element("div");
    			p8 = element("p");
    			t32 = text("Crushes: 2");
    			br14 = element("br");
    			t33 = text("\n            Funerals held: 1");
    			t34 = space();
    			section9 = element("section");
    			div9 = element("div");
    			p9 = element("p");
    			t35 = text("Cows we saw: Infinity");
    			br15 = element("br");
    			t36 = text("\n            Cows we ate: ~15");
    			br16 = element("br");
    			t37 = text("\n            Cows that died for no reason: 1");
    			t38 = space();
    			section10 = element("section");
    			div10 = element("div");
    			p10 = element("p");
    			p10.textContent = "Hearty meals with godma: 4";
    			t40 = space();
    			section11 = element("section");
    			div11 = element("div");
    			p11 = element("p");
    			t41 = text("Avocadoes: 5kg?");
    			br17 = element("br");
    			t42 = text("\n            Avocado smash: 5kg?");
    			t43 = space();
    			section12 = element("section");
    			div12 = element("div");
    			p12 = element("p");
    			t44 = text("Disclaimer: All numbers here are not fact-checked, but happy birthday froggiefoo!");
    			br18 = element("br");
    			t45 = text("\n            Thanks for being the best travel buddy!");
    			t46 = space();
    			section13 = element("section");
    			div13 = element("div");
    			p13 = element("p");
    			t47 = text("Cheers to more days of ");
    			b3 = element("b");
    			b3.textContent = "thriving 🌱";
    			t49 = space();
    			section14 = element("section");
    			add_location(b0, file$1, 163, 27, 3167);
    			add_location(br0, file$1, 163, 51, 3191);
    			add_location(i, file$1, 164, 3, 3199);
    			add_location(br1, file$1, 164, 31, 3227);
    			add_location(br2, file$1, 165, 3, 3235);
    			add_location(p0, file$1, 162, 10, 3136);
    			attr_dev(div0, "class", "text svelte-hvbjli");
    			add_location(div0, file$1, 161, 8, 3107);
    			attr_dev(section0, "class", "svelte-hvbjli");
    			add_location(section0, file$1, 160, 6, 3089);
    			add_location(p1, file$1, 172, 10, 3371);
    			attr_dev(div1, "class", "text svelte-hvbjli");
    			add_location(div1, file$1, 171, 8, 3342);
    			attr_dev(section1, "class", "svelte-hvbjli");
    			add_location(section1, file$1, 170, 6, 3324);
    			add_location(br3, file$1, 178, 37, 3514);
    			add_location(p2, file$1, 177, 10, 3473);
    			attr_dev(div2, "class", "text svelte-hvbjli");
    			add_location(div2, file$1, 176, 8, 3444);
    			attr_dev(section2, "class", "svelte-hvbjli");
    			add_location(section2, file$1, 175, 6, 3426);
    			add_location(b1, file$1, 185, 13, 3677);
    			add_location(br4, file$1, 185, 42, 3706);
    			add_location(br5, file$1, 186, 3, 3714);
    			add_location(br6, file$1, 187, 51, 3770);
    			add_location(br7, file$1, 188, 57, 3832);
    			add_location(br8, file$1, 189, 73, 3910);
    			add_location(p3, file$1, 185, 10, 3674);
    			attr_dev(div3, "class", "text svelte-hvbjli");
    			add_location(div3, file$1, 184, 8, 3645);
    			attr_dev(section3, "class", "svelte-hvbjli");
    			add_location(section3, file$1, 183, 6, 3627);
    			add_location(b2, file$1, 196, 12, 4023);
    			add_location(br9, file$1, 196, 26, 4037);
    			add_location(br10, file$1, 197, 26, 4070);
    			add_location(br11, file$1, 198, 26, 4103);
    			add_location(br12, file$1, 199, 31, 4141);
    			add_location(p4, file$1, 195, 10, 4007);
    			attr_dev(div4, "class", "text svelte-hvbjli");
    			add_location(div4, file$1, 194, 8, 3978);
    			attr_dev(section4, "class", "svelte-hvbjli");
    			add_location(section4, file$1, 193, 6, 3960);
    			add_location(p5, file$1, 206, 10, 4280);
    			attr_dev(div5, "class", "text svelte-hvbjli");
    			add_location(div5, file$1, 205, 8, 4251);
    			attr_dev(section5, "class", "svelte-hvbjli");
    			add_location(section5, file$1, 204, 6, 4233);
    			add_location(p6, file$1, 211, 10, 4421);
    			attr_dev(div6, "class", "text svelte-hvbjli");
    			add_location(div6, file$1, 210, 8, 4392);
    			attr_dev(section6, "class", "svelte-hvbjli");
    			add_location(section6, file$1, 209, 6, 4374);
    			add_location(br13, file$1, 217, 35, 4581);
    			add_location(p7, file$1, 216, 10, 4542);
    			attr_dev(div7, "class", "text svelte-hvbjli");
    			add_location(div7, file$1, 215, 8, 4513);
    			attr_dev(section7, "class", "svelte-hvbjli");
    			add_location(section7, file$1, 214, 6, 4495);
    			add_location(br14, file$1, 225, 22, 4746);
    			add_location(p8, file$1, 224, 10, 4720);
    			attr_dev(div8, "class", "text svelte-hvbjli");
    			add_location(div8, file$1, 223, 8, 4691);
    			attr_dev(section8, "class", "svelte-hvbjli");
    			add_location(section8, file$1, 222, 6, 4673);
    			add_location(br15, file$1, 233, 33, 4919);
    			add_location(br16, file$1, 234, 28, 4954);
    			add_location(p9, file$1, 232, 10, 4882);
    			attr_dev(div9, "class", "text svelte-hvbjli");
    			add_location(div9, file$1, 231, 8, 4853);
    			attr_dev(section9, "class", "svelte-hvbjli");
    			add_location(section9, file$1, 230, 6, 4835);
    			add_location(p10, file$1, 241, 10, 5105);
    			attr_dev(div10, "class", "text svelte-hvbjli");
    			add_location(div10, file$1, 240, 8, 5076);
    			attr_dev(section10, "class", "svelte-hvbjli");
    			add_location(section10, file$1, 239, 6, 5058);
    			add_location(br17, file$1, 247, 27, 5255);
    			add_location(p11, file$1, 246, 10, 5224);
    			attr_dev(div11, "class", "text svelte-hvbjli");
    			add_location(div11, file$1, 245, 8, 5195);
    			attr_dev(section11, "class", "svelte-hvbjli");
    			add_location(section11, file$1, 244, 6, 5177);
    			add_location(br18, file$1, 255, 93, 5491);
    			add_location(p12, file$1, 254, 10, 5394);
    			attr_dev(div12, "class", "text svelte-hvbjli");
    			add_location(div12, file$1, 253, 8, 5365);
    			attr_dev(section12, "class", "svelte-hvbjli");
    			add_location(section12, file$1, 252, 6, 5347);
    			add_location(b3, file$1, 263, 35, 5687);
    			add_location(p13, file$1, 262, 10, 5648);
    			attr_dev(div13, "class", "text svelte-hvbjli");
    			add_location(div13, file$1, 261, 8, 5619);
    			attr_dev(section13, "class", "svelte-hvbjli");
    			add_location(section13, file$1, 260, 6, 5601);
    			attr_dev(section14, "class", "svelte-hvbjli");
    			add_location(section14, file$1, 267, 3, 5756);
    			attr_dev(div14, "slot", "foreground");
    			attr_dev(div14, "class", "svelte-hvbjli");
    			add_location(div14, file$1, 159, 4, 3059);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div14, anchor);
    			append_dev(div14, section0);
    			append_dev(section0, div0);
    			append_dev(div0, p0);
    			append_dev(p0, t0);
    			append_dev(p0, b0);
    			append_dev(p0, t2);
    			append_dev(p0, br0);
    			append_dev(p0, t3);
    			append_dev(p0, i);
    			append_dev(p0, br1);
    			append_dev(p0, t5);
    			append_dev(p0, br2);
    			append_dev(p0, t6);
    			append_dev(div14, t7);
    			append_dev(div14, section1);
    			append_dev(section1, div1);
    			append_dev(div1, p1);
    			append_dev(div14, t9);
    			append_dev(div14, section2);
    			append_dev(section2, div2);
    			append_dev(div2, p2);
    			append_dev(p2, t10);
    			append_dev(p2, br3);
    			append_dev(p2, t11);
    			append_dev(div14, t12);
    			append_dev(div14, section3);
    			append_dev(section3, div3);
    			append_dev(div3, p3);
    			append_dev(p3, b1);
    			append_dev(p3, br4);
    			append_dev(p3, t14);
    			append_dev(p3, br5);
    			append_dev(p3, t15);
    			append_dev(p3, br6);
    			append_dev(p3, t16);
    			append_dev(p3, br7);
    			append_dev(p3, t17);
    			append_dev(p3, br8);
    			append_dev(div14, t18);
    			append_dev(div14, section4);
    			append_dev(section4, div4);
    			append_dev(div4, p4);
    			append_dev(p4, b2);
    			append_dev(p4, br9);
    			append_dev(p4, t20);
    			append_dev(p4, br10);
    			append_dev(p4, t21);
    			append_dev(p4, br11);
    			append_dev(p4, t22);
    			append_dev(p4, br12);
    			append_dev(p4, t23);
    			append_dev(div14, t24);
    			append_dev(div14, section5);
    			append_dev(section5, div5);
    			append_dev(div5, p5);
    			append_dev(div14, t26);
    			append_dev(div14, section6);
    			append_dev(section6, div6);
    			append_dev(div6, p6);
    			append_dev(div14, t28);
    			append_dev(div14, section7);
    			append_dev(section7, div7);
    			append_dev(div7, p7);
    			append_dev(p7, t29);
    			append_dev(p7, br13);
    			append_dev(p7, t30);
    			append_dev(div14, t31);
    			append_dev(div14, section8);
    			append_dev(section8, div8);
    			append_dev(div8, p8);
    			append_dev(p8, t32);
    			append_dev(p8, br14);
    			append_dev(p8, t33);
    			append_dev(div14, t34);
    			append_dev(div14, section9);
    			append_dev(section9, div9);
    			append_dev(div9, p9);
    			append_dev(p9, t35);
    			append_dev(p9, br15);
    			append_dev(p9, t36);
    			append_dev(p9, br16);
    			append_dev(p9, t37);
    			append_dev(div14, t38);
    			append_dev(div14, section10);
    			append_dev(section10, div10);
    			append_dev(div10, p10);
    			append_dev(div14, t40);
    			append_dev(div14, section11);
    			append_dev(section11, div11);
    			append_dev(div11, p11);
    			append_dev(p11, t41);
    			append_dev(p11, br17);
    			append_dev(p11, t42);
    			append_dev(div14, t43);
    			append_dev(div14, section12);
    			append_dev(section12, div12);
    			append_dev(div12, p12);
    			append_dev(p12, t44);
    			append_dev(p12, br18);
    			append_dev(p12, t45);
    			append_dev(div14, t46);
    			append_dev(div14, section13);
    			append_dev(section13, div13);
    			append_dev(div13, p13);
    			append_dev(p13, t47);
    			append_dev(p13, b3);
    			append_dev(div14, t49);
    			append_dev(div14, section14);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_foreground_slot.name,
    		type: "slot",
    		source: "(160:4) ",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let scroller;
    	let updating_index;
    	let updating_offset;
    	let updating_progress;
    	let updating_count;
    	let current;

    	function scroller_index_binding(value) {
    		/*scroller_index_binding*/ ctx[7](value);
    	}

    	function scroller_offset_binding(value) {
    		/*scroller_offset_binding*/ ctx[8](value);
    	}

    	function scroller_progress_binding(value) {
    		/*scroller_progress_binding*/ ctx[9](value);
    	}

    	function scroller_count_binding(value) {
    		/*scroller_count_binding*/ ctx[10](value);
    	}

    	let scroller_props = {
    		top: /*top*/ ctx[4],
    		bottom: /*bottom*/ ctx[6],
    		threshold: /*threshold*/ ctx[5],
    		splitscreen: true,
    		$$slots: {
    			foreground: [create_foreground_slot],
    			background: [create_background_slot]
    		},
    		$$scope: { ctx }
    	};

    	if (/*index*/ ctx[1] !== void 0) {
    		scroller_props.index = /*index*/ ctx[1];
    	}

    	if (/*offset*/ ctx[2] !== void 0) {
    		scroller_props.offset = /*offset*/ ctx[2];
    	}

    	if (/*progress*/ ctx[3] !== void 0) {
    		scroller_props.progress = /*progress*/ ctx[3];
    	}

    	if (/*count*/ ctx[0] !== void 0) {
    		scroller_props.count = /*count*/ ctx[0];
    	}

    	scroller = new Scroller({ props: scroller_props, $$inline: true });
    	binding_callbacks.push(() => bind(scroller, 'index', scroller_index_binding, /*index*/ ctx[1]));
    	binding_callbacks.push(() => bind(scroller, 'offset', scroller_offset_binding, /*offset*/ ctx[2]));
    	binding_callbacks.push(() => bind(scroller, 'progress', scroller_progress_binding, /*progress*/ ctx[3]));
    	binding_callbacks.push(() => bind(scroller, 'count', scroller_count_binding, /*count*/ ctx[0]));

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(scroller.$$.fragment);
    			attr_dev(main, "class", "body svelte-hvbjli");
    			add_location(main, file$1, 17, 0, 264);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(scroller, main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const scroller_changes = {};

    			if (dirty & /*$$scope, index*/ 4098) {
    				scroller_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_index && dirty & /*index*/ 2) {
    				updating_index = true;
    				scroller_changes.index = /*index*/ ctx[1];
    				add_flush_callback(() => updating_index = false);
    			}

    			if (!updating_offset && dirty & /*offset*/ 4) {
    				updating_offset = true;
    				scroller_changes.offset = /*offset*/ ctx[2];
    				add_flush_callback(() => updating_offset = false);
    			}

    			if (!updating_progress && dirty & /*progress*/ 8) {
    				updating_progress = true;
    				scroller_changes.progress = /*progress*/ ctx[3];
    				add_flush_callback(() => updating_progress = false);
    			}

    			if (!updating_count && dirty & /*count*/ 1) {
    				updating_count = true;
    				scroller_changes.count = /*count*/ ctx[0];
    				add_flush_callback(() => updating_count = false);
    			}

    			scroller.$set(scroller_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(scroller.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(scroller.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(scroller);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let color = "#5cc6b2";

    	// FOR SCROLLER COMPONENT
    	let count;

    	let index;
    	let offset;
    	let progress;
    	let top;
    	let threshold = 1.5;

    	//   let threshold = 0.9;
    	let bottom = 0.9;

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function scroller_index_binding(value) {
    		index = value;
    		$$invalidate(1, index);
    	}

    	function scroller_offset_binding(value) {
    		offset = value;
    		$$invalidate(2, offset);
    	}

    	function scroller_progress_binding(value) {
    		progress = value;
    		$$invalidate(3, progress);
    	}

    	function scroller_count_binding(value) {
    		count = value;
    		$$invalidate(0, count);
    	}

    	$$self.$capture_state = () => ({
    		Scroller,
    		color,
    		count,
    		index,
    		offset,
    		progress,
    		top,
    		threshold,
    		bottom
    	});

    	$$self.$inject_state = $$props => {
    		if ('color' in $$props) color = $$props.color;
    		if ('count' in $$props) $$invalidate(0, count = $$props.count);
    		if ('index' in $$props) $$invalidate(1, index = $$props.index);
    		if ('offset' in $$props) $$invalidate(2, offset = $$props.offset);
    		if ('progress' in $$props) $$invalidate(3, progress = $$props.progress);
    		if ('top' in $$props) $$invalidate(4, top = $$props.top);
    		if ('threshold' in $$props) $$invalidate(5, threshold = $$props.threshold);
    		if ('bottom' in $$props) $$invalidate(6, bottom = $$props.bottom);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		count,
    		index,
    		offset,
    		progress,
    		top,
    		threshold,
    		bottom,
    		scroller_index_binding,
    		scroller_offset_binding,
    		scroller_progress_binding,
    		scroller_count_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new App({target: document.body});

    return app;

}());
//# sourceMappingURL=bundle.js.map
