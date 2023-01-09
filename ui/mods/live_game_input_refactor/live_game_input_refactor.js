window.lgir = window.lgir || {}

;(function() {
  // ------------- Support Functions ----------

  lgir.uiScale = api.settings.getSynchronous('ui', 'ui_scale') || 1.0;

  live_game_settings_exit = handlers['settings.exit']
  handlers['settings.exit'] = function() {
    live_game_settings_exit()
    lgir.uiScale = api.settings.getSynchronous('ui', 'ui_scale') || 1.0;
  };

  lgir.scaleMouseEvent = lgir.scaleMouseEvent || function (mdevent) {
    if (mdevent.uiScaled)
      return;

    mdevent.uiScaled = true;

    mdevent.offsetX = Math.floor(mdevent.offsetX * lgir.uiScale);
    mdevent.offsetY = Math.floor(mdevent.offsetY * lgir.uiScale);
    mdevent.clientX = Math.floor(mdevent.clientX * lgir.uiScale);
    mdevent.clientY = Math.floor(mdevent.clientY * lgir.uiScale);
  };

  lgir.registerSelectionChangeFrom = function(prevSelection) {
    return function (selection) {
      if (!selection) return null

      var jSelection = JSON.parse(selection);
      model.parseSelection(jSelection);
      model.playSelectionSound(!!prevSelection, prevSelection, !!model.selection(), model.selection());
      return jSelection;
    }
  }

  lgir.playCommandSound = function(event, command) {
    return function (success) {
      command = command || success
      event.holodeck.showCommandConfirmation(success ? command : "",
                                       event.offsetX, event.offsetY);
      if (!success || (command === 'move')) {
        // Note: move currently plays its own sound.
        return;
      }
      var action = command.charAt(0).toUpperCase() + command.slice(1);
      api.audio.playSound("/SE/UI/UI_Command_" + action);
    };
  }

  // ------------- Multi-stage Command Parts ----------

  lgir.draggableCommand = function(mdevent, delay, responders) {
    var dragTime = new Date().getTime() + delay;
    var dragging = false
    var polling = true

    var setDragging = function(drag) {
      dragging = drag
      polling = !drag
    }
    var cancelDragging = function() {
      dragging = false
      polling = false
    }

    input.capture(mdevent.holodeck.div, function (event) {
      lgir.scaleMouseEvent(event)

      event.holodeck = mdevent.holodeck
      //if (model.showTimeControls())
        //model.endCommandMode();

      if ((event.type === 'mousemove') && polling && ((new Date().getTime()) >= dragTime)) {
        polling = false;
        dragging = true;
        delete mdevent.holodeck.doubleClickTime;
        responders.start(event, setDragging, cancelDragging)
      }
      else if ((event.type === 'mouseup') && (event.button === mdevent.button)) {
        input.release();
        if (dragging) {
          responders.end(event)
        } else {
          responders.click(event)
        }
      }
      else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
        input.release();
        responders.cancel(event)
      }
    });
  }

  lgir.captureFormationFacing = function(mdevent, muevent,
                                          command, shouldAppend, onExit) {
    mdevent.holodeck.unitChangeCommandState(command,
        muevent.offsetX, muevent.offsetY, shouldAppend(muevent))
      .then(function (success) {
      if (!success)
        return;

      input.capture(mdevent.holodeck.div, function (event) {
        lgir.scaleMouseEvent(event)
        event.holodeck = mdevent.holodeck

        if ((event.type === 'mousedown') && (event.button === mdevent.button)) {
          input.release();
          mdevent.holodeck.unitEndCommand(command,
              event.offsetX, event.offsetY, shouldAppend(event))
            .then(lgir.playCommandSound(event, command))
          onExit('complete', event)
        }
        else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
          input.release();
          mdevent.holodeck.unitCancelCommand();
          onExit('escape', event)
        }
      });
    });
  }

  // -------------- Button Functions -----------------

  lgir.holdMousePan = function(mdevent) {
    var oldMode = model.mode();
    model.mode('camera');
    mdevent.holodeck.beginControlCamera();
    input.capture(mdevent.holodeck.div, function (event) {
      lgir.scaleMouseEvent(event)

      var mouseDone = ((event.type === 'mouseup') && (event.button === mdevent.button));
      var escKey = ((event.type === 'keydown') && (event.keyCode === keyboard.esc));
      if (mouseDone || escKey) {
        input.release();
        mdevent.holodeck.endControlCamera();
        if (model.mode() === 'camera')
          model.mode(oldMode);
      }
    });
  }

  lgir.completeFabRotate = function(mdevent, event) {
    var snap = lgir.shouldSnap(event)
    event.holodeck.unitEndFab(event.offsetX, event.offsetY, lgir.shouldAppendFab(mdevent), snap).then(function (success) {
      event.holodeck.showCommandConfirmation("", event.offsetX, event.offsetY);
      if (success)
        api.audio.playSound("/SE/UI/UI_Building_place");
    });
    model.mode('fab');

    lgir.watchForEnd(event,
                      lgir.shouldExitModeFab,
                      model.fabCount,
                      model.endFabMode)
  }

  lgir.beginFabDown = function(mdevent) {
    mdevent.holodeck.unitBeginFab(
      mdevent.offsetX,
      mdevent.offsetY,
      lgir.shouldSnap(mdevent))

    model.mode('fab_rotate');
    input.capture(mdevent.holodeck.div, function (event) {
      lgir.scaleMouseEvent(event)
      event.holodeck = mdevent.holodeck
      if ((event.type === 'mouseup') && (event.button === mdevent.button)) {
        input.release();
        lgir.completeFabRotate(mdevent, event)
      }
      else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
        input.release();
        mdevent.holodeck.unitCancelFab();
        model.endFabMode();
      }
    });
  }

  lgir.celestialTargetDown = function(mdevent) {
    if (model.celestialControlModel.findingTargetPlanet()) {
      model.celestialControlModel.mousedown(mdevent);

      input.capture($('body'), function (event) {
        lgir.scaleMouseEvent(event)
        if (event.type === 'mouseup' && event.button === mdevent.button) {
          model.celestialControlModel.mouseup(event);
          input.release();
        }
      });
    }
  }

  lgir.selectSingleClick = function(mdevent) {
    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;

    var prevSelection = model.selection();

    delete holodeck.doubleClickId;
    model.mode('select');

    lgir.draggableCommand(mdevent, 0, {
      start: function(event) {
        holodeck.beginDragSelect(startx, starty);
      },
      end: function(event) {
        var option = lgir.getSelectOption(event);
        holodeck.endDragSelect(option, {
          left: startx,
          top: starty,
          right: event.offsetX,
          bottom: event.offsetY
        }).then(lgir.registerSelectionChangeFrom(prevSelection))

        model.mode('default');
      },
      click: function(event) {
        if (model.hasWorldHoverTarget())
          holodeck.doubleClickId = model.worldHoverTarget();
        var index = (holodeck.clickOffset || 0);
        var option = lgir.getSelectOption(event);
        holodeck.selectAt(option, startx, starty, index)
          .then(lgir.registerSelectionChangeFrom(prevSelection))
          .then(function (selection) {
            if (selection && selection.selectionResult) {
              holodeck.doubleClickId = selection.selectionResult[0];
              ++holodeck.clickOffset;
              if (!selection.selectionResult.length)
                api.camera.maybeSetFocusPlanet();

            }
          });

        model.mode('default');
        holodeck.showCommandConfirmation("", event.offsetX, event.offsetY);
      },
      cancel: function() {
        holodeck.endDragSelect('cancel');
        model.mode('default');
      }
    })
  }

  lgir.selectDoubleClick = function(mdevent) {
    if (mdevent.holodeck.hasOwnProperty('doubleClickId')) {
      mdevent.holodeck.selectMatchingUnits(
          lgir.getSelectOption(mdevent),
          [mdevent.holodeck.doubleClickId])
        .then(lgir.registerSelectionChangeFrom(model.selection()))
      delete mdevent.holodeck.doubleClickId;
    }
  }

  lgir.selectDown = function(mdevent) {
    var now = new Date().getTime();
    if (now < mdevent.holodeck.doubleClickTime) {
      lgir.selectDoubleClick(mdevent)

      delete mdevent.holodeck.doubleClickTime;
    }
    else {
      mdevent.holodeck.doubleClickTime = now + 250;

      lgir.selectSingleClick(mdevent)
    }
  }

  lgir.standardDown = function(mdevent) {
    if (model.celestialControlActive()) {
      lgir.celestialTargetDown(mdevent)
    } else {
      lgir.selectDown(mdevent)
    }
  }

  lgir.contextualActionDown = function(mdevent) {
    if (model.showTimeControls()) return false
    if (model.celestialControlActive()) return false

    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;

    var dragCommand = "";
    var ended = false

    function click(event) {
      var append = lgir.shouldAppendContext(event)
      holodeck.unitGo(startx, starty, append)
        .then(lgir.playCommandSound(mdevent, null))
      model.mode('default');
    }

    lgir.draggableCommand(mdevent, 75, {
      start: function(event, setDragging, cancelDragging) {
        holodeck.unitBeginGo(startx, starty, model.allowCustomFormations()).then( function(ok) {
          // unitBeginGo is async, so we can receive a mouseup in the meatime
          // draggableCommand sets dragging status, which we have not yet confirmed, so the mouseup results in an 'end' callback instead of 'click'
          if (ended) return click(event)
          dragCommand = ok;
          if (dragCommand) {
            model.mode("command_" + dragCommand);
            setDragging(true)
          } else {
            setDragging(false)
          }
        } );
      },
      end: function(event) {
        var append = lgir.shouldAppendContext(event)
        holodeck.unitEndCommand(dragCommand,
            event.offsetX, event.offsetY, append)
          .then(lgir.playCommandSound(event, dragCommand))

        ended = true
        // not in vanilla, but we had to set mode to get here
        model.mode('default');
      },
      click: click,
      cancel: function(event) {
        holodeck.unitCancelCommand();
        model.mode('default');
      },
    })

    return true;
  }

  lgir.completeFormationCommand = function(reason, lastEvent) {
    if (reason == 'escape') {
      model.endCommandMode()
    } else {
      lgir.watchForEnd(lastEvent,
                        lgir.shouldExitModeCommand,
                        model.cmdQueueCount,
                        model.endCommandMode)
    }
  }

  lgir.commandModeDown = function(mdevent, command) {
    api.camera.maybeSetFocusPlanet()
    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;

    if (!model.allowCustomFormations() && (command === 'move' || command === 'unload')) {
      var append = lgir.shouldAppendCommand(mdevent)
      holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, append)
        .then(lgir.playCommandSound(mdevent, command));

      lgir.watchForEnd(mdevent,
                        lgir.shouldExitModeCommand,
                        model.cmdQueueCount,
                        model.endCommandMode)
      return
    }

    lgir.draggableCommand(mdevent, 125, {
      start: function(event, setDragging) {
        holodeck.unitBeginCommand(command, startx, starty).then(setDragging);
      },
      end: function(event) {
        var append = lgir.shouldAppendCommand(event)
        holodeck.unitEndCommand(command,
            event.offsetX, event.offsetY, append)
          .then(lgir.playCommandSound(event, command))
        lgir.watchForEnd(event,
                          lgir.shouldExitModeCommand,
                          model.cmdQueueCount,
                          model.endCommandMode)
      },
      click: function(event) {
        var append = lgir.shouldAppendCommand(event)
        holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, append)
          .then(lgir.playCommandSound(mdevent, command));

        lgir.watchForEnd(event,
                          lgir.shouldExitModeCommand,
                          model.cmdQueueCount,
                          model.endCommandMode)
      },
      cancel: function(event) {
        holodeck.unitCancelCommand();
        model.mode('command_' + command);
      },
    })
  }

  // ---------------- Modifier Keys -----------

  lgir.getSelectOption = function(event) {
    if (event.shiftKey)
    {
      if (event.ctrlKey)
        return 'remove';
      else
        return 'add';
    }
    else if (event.ctrlKey)
      return 'toggle';
    else
      return '';
  };

  lgir.endWatchEvent = 'keyup'

  lgir.shouldAppendFab = function(event) {
    return event.shiftKey
  }
  lgir.shouldExitModeFab = function(event) {
    return !event.shiftKey
  }

  lgir.shouldAppendContext = function(event) {
    return event.shiftKey
  }
  //no exit, context isn't a mode

  lgir.shouldAppendCommand = function(event) {
    return event.shiftKey
  }
  lgir.shouldExitModeCommand = function(event) {
    return !event.shiftKey
  }

  lgir.watchForEnd = function(event, shouldExit, counter, onEnd) {
    counter(counter() + 1);
    if (shouldExit(event)) {
      onEnd()
    } else if (counter() === 1) {
      var endWatch = function (keyEvent) {
        if (shouldExit(keyEvent)) {
          //console.log('remove watcher')
          $('body').off(lgir.endWatchEvent, endWatch);
          onEnd()
        }
      };
      //console.log('install watcher')
      $('body').on(lgir.endWatchEvent, endWatch);
    }
  }

  lgir.shouldSnap = function(event) {
    return !event.ctrlKey
  }

  // ---------------- Modal Response/Button Routing -----------

  lgir.holodeckModeMouseDown = {};

  var LeftButton = 0
  var MiddleButton = 1
  var RightButton = 2

  lgir.holodeckModeMouseDown.fab = function (mdevent) {
    if (mdevent.button === LeftButton) {
      lgir.beginFabDown(mdevent)
      return true;
    }
    else if (mdevent.button === RightButton) {
      model.endFabMode();
      return true;
    }
    return false;
  };

  lgir.holodeckModeMouseDown['default'] = function (mdevent) {
    if (mdevent.button === LeftButton) {
      lgir.standardDown(mdevent)
      return true;
    }
    else if (mdevent.button === RightButton) {
      return lgir.contextualActionDown(mdevent)
    }
    return false;
  };

  var holodeckCommandMouseDown = function (command) {
    return function (mdevent) {
      if (mdevent.button === LeftButton || mdevent.button === RightButton) {
        lgir.commandModeDown(mdevent, command)
        return true;
      }
    };
  };

  for (var i = 0; i < model.commands().length; ++i) {
    var command = model.commands()[i];
    lgir.holodeckModeMouseDown['command_' + command] =
      holodeckCommandMouseDown(command);
  }

  lgir.holodeckMouseDown = function (mdevent) {
    lgir.scaleMouseEvent(mdevent)
    mdevent.holodeck = api.Holodeck.get(this);

    var handler = lgir.holodeckModeMouseDown[model.mode()];
    if (handler && handler(mdevent)) {
      mdevent.preventDefault();
      mdevent.stopPropagation();
      return;
    }

    if (mdevent.button === MiddleButton) {
      lgir.holdMousePan(mdevent)
      mdevent.preventDefault();
      mdevent.stopPropagation();
      return;
    }

    // Don't think this will happen
    // I think it's here to get out of minor modes without handlers
    if (mdevent.button === RightButton && model.mode() !== 'default') {
      model.endCommandMode()
    }
  }

  //  :-( :-( :-(
  $('holodeck').off('mousedown')

  $('holodeck').mousedown(function(mdevent) {
    if (mdevent.target.nodeName !== 'HOLODECK')
      return;

    //var t1 = new Date().getTime()
    lgir.holodeckMouseDown.apply(this, arguments)
    //var t2 = new Date().getTime()
    //console.log(t2 - t1)
  });
})()
