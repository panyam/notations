/**
 * Tabbed Examples Component
 *
 * Provides tab switching functionality for Source/Output examples.
 * Used across integration guide pages (React, Vue, Node.js, etc.)
 */

(function() {
  'use strict';

  /**
   * Initialize all tabbed examples on the page
   */
  function initTabbedExamples() {
    const tabbedExamples = document.querySelectorAll('.tabbed-example');

    tabbedExamples.forEach(function(container) {
      const tabs = container.querySelectorAll('.tab-btn');
      const contents = container.querySelectorAll('.tab-content');

      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          const targetId = this.getAttribute('data-tab');

          // Deactivate all tabs and contents
          tabs.forEach(function(t) { t.classList.remove('active'); });
          contents.forEach(function(c) { c.classList.remove('active'); });

          // Activate clicked tab and corresponding content
          this.classList.add('active');
          const targetContent = container.querySelector('#' + targetId);
          if (targetContent) {
            targetContent.classList.add('active');
          }
        });
      });
    });
  }

  /**
   * Create a tabbed example programmatically
   * @param {Object} options - Configuration options
   * @param {string} options.source - Source code to display
   * @param {string} options.caption - Optional caption for the example
   * @param {HTMLElement} options.container - Container element
   * @param {Function} options.renderOutput - Function to render the output
   */
  window.createTabbedExample = function(options) {
    const id = 'tabbed-' + Math.random().toString(36).substr(2, 9);

    const wrapper = document.createElement('div');
    wrapper.className = 'tabbed-example';

    // Caption
    if (options.caption) {
      const captionEl = document.createElement('div');
      captionEl.className = 'tabbed-example-caption';
      captionEl.textContent = options.caption;
      wrapper.appendChild(captionEl);
    }

    // Tab header
    const header = document.createElement('div');
    header.className = 'tabbed-example-header';
    header.innerHTML =
      '<button class="tab-btn active" data-tab="' + id + '-source">Source</button>' +
      '<button class="tab-btn" data-tab="' + id + '-output">Output</button>';
    wrapper.appendChild(header);

    // Source tab content
    const sourceContent = document.createElement('div');
    sourceContent.id = id + '-source';
    sourceContent.className = 'tab-content active';
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = options.source;
    pre.appendChild(code);
    sourceContent.appendChild(pre);
    wrapper.appendChild(sourceContent);

    // Output tab content
    const outputContent = document.createElement('div');
    outputContent.id = id + '-output';
    outputContent.className = 'tab-content';
    outputContent.innerHTML = '<div class="output-container"></div>';
    wrapper.appendChild(outputContent);

    // Add to container
    options.container.appendChild(wrapper);

    // Initialize tabs for this new element
    const tabs = wrapper.querySelectorAll('.tab-btn');
    const contents = wrapper.querySelectorAll('.tab-content');

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        const targetId = this.getAttribute('data-tab');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        contents.forEach(function(c) { c.classList.remove('active'); });
        this.classList.add('active');
        wrapper.querySelector('#' + targetId).classList.add('active');
      });
    });

    // Render output if function provided
    if (options.renderOutput) {
      options.renderOutput(outputContent.querySelector('.output-container'));
    }

    return wrapper;
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTabbedExamples);
  } else {
    initTabbedExamples();
  }
})();
