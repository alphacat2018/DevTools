// noinspection JSUnusedGlobalSymbols
const extension = {
  options: {
    sync: new OptionSection(
      chrome.storage.sync,
      {
        wrapNavigation: false,
        autoSelectFirst: true,
        nextKey: 'down, j',
        previousKey: 'up, k',
        navigateKey: 'return, space',
        navigateNewTabBackgroundKey: 'ctrl+return, command+return, ctrl+space',
        navigateNewTabKey: 'ctrl+shift+return, command+shift+return, ctrl+shift+space',
      }
    ),

    local: new OptionSection(
      chrome.storage.local,
      {
        lastQueryUrl: null,
        lastFocusedIndex: 0
      }
    ),

    load() {
      return Promise.all([this.local.load(), this.sync.load()]);
    },
  },

  hostToSearcher: {
    "baidu": getBaiduSearchLinks,
    "google": getGoogleSearchLinks,
    "bing": getBingSearchLinks,
  },

  init() {
    window.addEventListener('keyup', e => {
      // if something else took care of this event or if the target of
      // the event is an input field then just ignore it
      if (e.defaultPrevented) {
        return;
      }

      if (e.code === "KeyS" && e.altKey) {
        this.tryFocusInput(e);
      }else if (e.key === 'Alt') {
        this._waitingKeyS = true
        setTimeout(() => {
          this._waitingKeyS = false
        }, 300)
      } else if (e.key === "s" && this._waitingKeyS) {
        this.tryFocusInput(e);
      }
    }, false);


    this.searcher = null
    Object.keys(this.hostToSearcher).forEach(key => {
      if (window.location.hostname.includes(key)) {
        this.searcher = this.hostToSearcher[key]
      }
    })

    if (!this.searcher)
      return;

    this.insertQuickNavigationIfNecessary()
  },

  tryFocusInput(e) {
    e.stopPropagation();
    e.preventDefault();

    var input = findAppropriateField();
    console.warn ("input", input)
    if (input)
      input.focus();
  },

  insertQuickNavigationIfNecessary() {
    if (!hasHighlightElement()) {
      this.insertQuickNavigation()
    }
  },

  insertQuickNavigation() {
    const params = getQueryStringParams();
    const loadOptions = this.options.load();
    // Don't initialize results navigation on image search, since it doesn't work
    // there.
    if (params['tbm'] !== 'isch') {
      // This file is loaded only after the DOM is ready, so no need to wait for
      // DOMContentLoaded.
      loadOptions.then(() => this.initResultsNavigation());
    }
  },

  initResultsNavigation() {
    const options = this.options.sync.values;
    const lastNavigation = this.options.local.values;
    const results = this.searcher();
    if (!results)
      return;

    let isFirstNavigation = true;
    if (options.autoSelectFirst) {
      // Highlight the first result when the page is loaded.
      results.focus(0);
    }
    if (location.href === lastNavigation.lastQueryUrl) {
      isFirstNavigation = false;
      results.focus(lastNavigation.lastFocusedIndex);
    }
    this.register(options.nextKey, () => {
      this.insertQuickNavigationIfNecessary();
      if (!options.autoSelectFirst && isFirstNavigation) {
        results.focus(0);
        isFirstNavigation = false;
      }
      else {
        results.focusNext(options.wrapNavigation);
      }
    });
    this.register(options.previousKey, () => {
      this.insertQuickNavigationIfNecessary();
      if (!options.autoSelectFirst && isFirstNavigation) {
        results.focus(0);
        isFirstNavigation = false;
      }
      else {
        results.focusPrevious(options.wrapNavigation);
      }
    });
    const that = this;
    this.register(options.navigateNewTabKey, () => {
      const link = results.items[results.focusedIndex];
      // NOTE: Firefox (tested in 58) somehow from single window.open() opened
      // a link twice. Using timeout solves the issue.
      window.setTimeout(() => window.open(link.anchor.href));
    });
    this.register(options.navigateNewTabBackgroundKey, () => {
      const link = results.items[results.focusedIndex];
      chrome.tabs.create({ url: link.anchor.href }, false)
    });
  },

  register(shortcut, callback) {
    key(shortcut, function (event) {
      callback();
      if (event !== null) {
        event.stopPropagation();
        event.preventDefault();
      }
      return false;
    });
  }
};

/**
 * @param {StorageArea} storage The storage area to which this section will write.
 * @param {Object} defaultValues The default options.
 * @constructor
 */
function OptionSection(storage, defaultValues) {
  this.storage = storage;
  this.values = defaultValues;
  this.load = function () {
    return new Promise((resolve) => {
      this.storage.get(
        this.values,
        (values) => {
          if (!chrome.runtime.lastError) {
            this.values = values;
          }
          resolve();
        }
      );
    });
  };
  this.save = function () {
    return new Promise((resolve, reject) => {
      this.storage.set(
        this.values,
        () => {
          if (chrome.runtime.lastError) {
            reject();
          }
          else {
            resolve();
          }
        }
      )
    });
  };
}

/**
 * @param {...[Element[], function|null]} results The array of tuples.
 * Each tuple contains collection of the search results optionally accompanied
 * with their container selector.
 * @constructor
 */
function SearchResultCollection(...results) {
  /**
   * @type {SearchResult[]}
   */
  this.items = [];
  for (let i = 0; i < results.length; i++) {
    const params = results[i];
    const nodes = params[0];
    const containerSelector = params[1];
    for (let j = 0; j < nodes.length; j++) {
      const node = nodes[j];
      this.items.push(new SearchResult(node, containerSelector));
    }
  }
  // need to sort items by their document position)
  this.items.sort((a, b) => {
    const position = a.anchor.compareDocumentPosition(b.anchor);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      return -1;
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {
      return 1;
    } else {
      return 0;
    }
  });
  this.focusedIndex = 0;
  this.focus = function (index) {
    if (this.focusedIndex >= 0) {
      if (this.items[this.focusedIndex])
        this.items[this.focusedIndex].anchor.classList.remove('highlighted-search-result');
    }
    const newItem = this.items[index];
    if (!newItem)
      return;

    newItem.anchor.classList.add('highlighted-search-result');
    newItem.anchor.focus();
    // ensure whole search result container is visible in the viewport, not only
    // the search result link
    const container = newItem.getContainer() || newItem.anchor;
    const containerBounds = container.getBoundingClientRect();
    // firefox displays tooltip at the bottom which obstructs the view
    // as a workaround ensure extra space from the bottom in the viewport
    // firefox detection (https://stackoverflow.com/a/7000222/2870889)
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    // hardcoded height of the tooltip plus some margin
    const firefoxBottomDelta = 26;
    const bottomDelta = (isFirefox ? firefoxBottomDelta : 0);
    if (containerBounds.top < 0) {
      // scroll container to top
      container.scrollIntoView(true);
    }
    else if (containerBounds.bottom + bottomDelta > window.innerHeight) {
      // scroll container to bottom
      container.scrollIntoView(false);
      window.scrollBy(0, bottomDelta);
    }
    this.focusedIndex = index;
  };
  this.focusNext = function (shouldWrap) {
    let nextIndex = 0;
    if (this.focusedIndex < this.items.length - 1) {
      nextIndex = this.focusedIndex + 1;
    }
    else if (!shouldWrap) {
      nextIndex = this.focusedIndex;
    }
    this.focus(nextIndex);
  };
  this.focusPrevious = function (shouldWrap) {
    let previousIndex = this.items.length - 1;
    if (this.focusedIndex > 0) {
      previousIndex = this.focusedIndex - 1;
    }
    else if (!shouldWrap) {
      previousIndex = this.focusedIndex;
    }
    this.focus(previousIndex);
  }
}

/**
 * @param {Element} anchor
 * @param {function|null} containerSelector
 * @constructor
 */
function SearchResult(anchor, containerSelector) {
  this.anchor = anchor;
  this.getContainer = function () {
    if (!containerSelector) {
      return this.anchor;
    }

    return containerSelector(this.anchor);
  };
}

function getQueryStringParams() {
  const encodedQueryString = window.location.search.slice(1);
  const encodedParams = encodedQueryString.split('&');
  const params = {};
  for (const encodedParam of encodedParams) {
    let [key, encodedValue] = encodedParam.split('=');
    if (!encodedValue) {
      encodedValue = '';
    }
    // + (plus sign) is not decoded by decodeURIComponent so we need to decode
    // it manually.
    encodedValue = encodedValue.replace(/\+/g, ' ');
    params[key] = decodeURIComponent(encodedValue);
  }
  return params;
}

function getGoogleSearchLinks() {
  // the nodes are returned in the document order which is what we want
  return new SearchResultCollection(
    [document.querySelectorAll('h3.r a'), (n) => n.parentElement.parentElement],
    [document.querySelectorAll('#pnprev, #pnnext'), null]
  );
}

function getBaiduSearchLinks() {
  // the nodes are returned in the document order which is what we want
  return new SearchResultCollection(
    [document.querySelectorAll('h3.t a'), null],
    [document.querySelectorAll('a.n'), null]
  );
}

function getBingSearchLinks() {
  // the nodes are returned in the document order which is what we want
  return new SearchResultCollection(
    [document.querySelectorAll('h2 a'), null],
    [document.querySelectorAll('a.sb_pagP, a.sb_pagN'), null]
  );
}

function getElementByXpath(path) {
  return document
    .evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
    .singleNodeValue;
}
function hasHighlightElement() {
  var element = document.querySelector('.highlighted-search-result')
  return element
}


function findAppropriateField() {
  var sel = document.querySelector(
    // these are sane versions of what search field is named
    'input[id=search], input[name=search],' +
    'input[id*=search], input[name*=search],' +
    'input[class*=search],' +
    // and these are purely empirical
    'input[name=q], [id*=search] input[type=text], [id*=search] input[type=search],' +
    '[id=lst-ib] input'
  );

  if (!sel) {
    sel = document.querySelector ("input")
  }

  return sel
}