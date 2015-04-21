(function() {
  model.registerSelectionChangeFrom = function(prevSelection) {
    return function (selection) {
      if (!selection) return null

      var jSelection = JSON.parse(selection);
      model.parseSelection(jSelection);
      model.playSelectionSound(!!prevSelection, prevSelection, !!model.selection(), model.selection());
      return jSelection;
    }
  }

  model.draggableCommand = function(mdevent, delay, responders) {
    var dragTime = new Date().getTime() + 0;
    var dragging = false
    input.capture(mdevent.holodeck.div, function (event) {
      event.holodeck = mdevent.holodeck
      //if (model.showTimeControls())
        //model.endCommandMode();

      if ((event.type === 'mousemove') && ((new Date().getTime()) >= dragTime)) {
        if (!dragging) {
          dragging = true;
          responders.start(event, function(drag) {dragging = drag})
        }
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

  model.captureFormationFacing = function(mdevent, event, command, queue, onExit) {
    mdevent.holodeck.unitChangeCommandState(command,
        event.offsetX, event.offsetY, queue)
      .then(function (success) {
      if (!success)
        return;

      input.capture(mdevent.holodeck.div, function (event) {
        event.holodeck = mdevent.holodeck
        if ((event.type === 'mousedown') && (event.button === mdevent.button)) {
          input.release();
          mdevent.holodeck.unitEndCommand(command, event.offsetX, event.offsetY, queue)
            .then(model.playCommandSound(event, command))
          onExit()
        }
        else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
          input.release();
          mdevent.holodeck.unitCancelCommand();
          onExit()
        }
      });
    });
  }

  model.playCommandSound = function(event, command) {
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

  model.holdMousePan = function(mdevent) {
    var oldMode = model.mode();
    model.mode('camera');
    mdevent.holodeck.beginControlCamera();
    input.capture(mdevent.holodeck.div, function (event) {
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

  model.completeFabRotate = function(queue, event) {
    var snap = model.shouldSnap(event)
    event.holodeck.unitEndFab(event.offsetX, event.offsetY, queue, snap).then(function (success) {
      event.holodeck.showCommandConfirmation("", event.offsetX, event.offsetY);
      if (success)
        api.audio.playSound("/SE/UI/UI_Building_place");
    });
    if (model.mode() === 'fab_end') queue = false;
    model.mode('fab');
    if (!queue)
      model.endFabMode();
  }

  model.beginFabDown = function(mdevent) {
    var queue = model.checkQueueAndWatchForEnd(mdevent, model.fabCount, function() {
      if (model.mode() === 'fab')
        model.endFabMode();
      else if (model.mode() === 'fab_rotate')
        model.mode('fab_end');
    })

    mdevent.holodeck.unitBeginFab(
      mdevent.offsetX,
      mdevent.offsetY,
      model.shouldSnap(mdevent))

    model.mode('fab_rotate');
    input.capture(mdevent.holodeck.div, function (event) {
      event.holodeck = mdevent.holodeck
      if ((event.type === 'mouseup') && (event.button === mdevent.button)) {
        input.release();
        model.completeFabRotate(queue, event)
      }
      else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
        input.release();
        mdevent.holodeck.unitCancelFab();
        model.endFabMode();
      }
    });
  }

  model.celestialTargetDown = function(mdevent) {
    if (model.celestialControlModel.findingTargetPlanet()) {
      model.celestialControlModel.mousedown(mdevent);

      input.capture($('body'), function (event) {
        if (event.type === 'mouseup' && event.button === mdevent.button) {
          model.celestialControlModel.mouseup(event);
          input.release();
        }
      });
    }
  }

  model.selectSingleClick = function(mdevent) {
    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;

    var prevSelection = model.selection();

    delete holodeck.doubleClickId;
    model.mode('select');

    model.draggableCommand(mdevent, 0, {
      start: function(event) {
        holodeck.beginDragSelect(startx, starty);
      },
      end: function(event) {
        var option = model.getSelectOption(event);
        holodeck.endDragSelect(option, {
          left: startx,
          top: starty,
          right: event.offsetX,
          bottom: event.offsetY
        }).then(model.registerSelectionChangeFrom(prevSelection))

        model.mode('default');
      },
      click: function(event) {
        if (model.hasWorldHoverTarget())
          holodeck.doubleClickId = model.worldHoverTarget();
        var index = (holodeck.clickOffset || 0);
        var option = model.getSelectOption(event);
        holodeck.selectAt(option, startx, starty, index)
          .then(model.registerSelectionChangeFrom(prevSelection))
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

  model.selectDoubleClick = function(mdevent) {
    if (mdevent.holodeck.hasOwnProperty('doubleClickId')) {
      mdevent.holodeck.selectMatchingUnits(
          model.getSelectOption(mdevent),
          [mdevent.holodeck.doubleClickId])
        .then(model.registerSelectionChangeFrom(model.selection()))
      delete mdevent.holodeck.doubleClickId;
    }
  }

  model.selectDown = function(mdevent) {
    var now = new Date().getTime();
    if (now < mdevent.holodeck.doubleClickTime) {
      model.selectDoubleClick(mdevent)

      delete mdevent.holodeck.doubleClickTime;
    }
    else {
      mdevent.holodeck.doubleClickTime = now + 250;

      model.selectSingleClick(mdevent)
    }
  }

  model.standardDown = function(mdevent) {
    if (model.celestialControlActive()) {
      model.celestialTargetDown(mdevent)
    } else {
      model.selectDown(mdevent)
    }
  }

  model.contextualActionDown = function(mdevent) {
    if (model.showTimeControls()) return false
    if (model.celestialControlActive()) return false

    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;
    var queue = model.shouldQueueCommand(mdevent)

    var dragCommand = "";

    model.draggableCommand(mdevent, 75, {
      start: function(event) {
        holodeck.unitBeginGo(startx, starty, model.allowCustomFormations()).then( function(ok) {
          dragCommand = ok;
          if (dragCommand)
            model.mode("command_" + dragCommand);
        } );
      },
      end: function(event) {
        if (dragCommand === 'move') {
          model.captureFormationFacing(mdevent, event, 'move', queue,
                                      function() {model.mode('default')})
        } else {
          holodeck.unitEndCommand(dragCommand,
              event.offsetX, event.offsetY, queue)
            .then(model.playCommandSound(event, dragCommand))
        }
      },
      click: function(event) {
        holodeck.unitGo(startx, starty, queue)
          .then(model.playCommandSound(event, null))
        model.mode('default');
      },
      cancel: function(event) {
        holodeck.unitCancelCommand();
        model.mode('default');
      },
    })

    return true;
  }

  model.commandModeDown = function(mdevent, command, targetable) {
    engine.call('camera.cameraMaybeSetFocusPlanet');
    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;
    var queue = model.checkQueueAndWatchForEnd(mdevent, model.cmdQueueCount, model.endCommandMode)

    if (!model.allowCustomFormations() && (command === 'move' || command === 'unload')) {
      holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, queue)
        .then(model.playCommandSound(mdevent, command));
      if (!queue)
        model.endCommandMode();

      return
    }

    model.draggableCommand(mdevent, 125, {
      start: function(event, setDragging) {
        holodeck.unitBeginCommand(command, startx, starty).then(setDragging);
      },
      end: function(event) {
        if ((command === 'move' || command === 'unload')) {
          model.captureFormationFacing(mdevent, event, command, queue,
              function() {
                if (!queue)
                  model.endCommandMode();
              })
        }
        else {
          holodeck.unitEndCommand(command,
              event.offsetX, event.offsetY, queue)
            .then(model.playCommandSound(event, command))
          if (!queue)
            model.endCommandMode();
        }
      },
      click: function(event) {
        if (model.hasWorldHoverTarget() && targetable) {
          api.unit.targetCommand(command, model.worldHoverTarget(), queue)
            .then(model.playCommandSound(event, command));
        }
        else {
          holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, queue)
            .then(model.playCommandSound(event, command));
        }

        if (!queue)
          model.endCommandMode();
      },
      cancel: function(event) {
        holodeck.unitCancelCommand();
        model.mode('command_' + command);
      },
    })
  }

  var LeftButton = 0
  var MiddleButton = 1
  var RightButton = 2

  model.getSelectOption = function(event) {
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

  model.endQueueWatchEvent = 'keyup'
  model.shouldQueueCommand = function(event) {
    return event.shiftKey
  }

  model.checkQueueAndWatchForEnd = function(mdevent, counter, onEnd) {
    var queue = model.shouldQueueCommand(mdevent)
    counter(counter() + 1);
    if (queue && (counter() === 1)) {
      var queueWatch = function (keyEvent) {
        if (!model.shouldQueueCommand(keyEvent)) {
          $('body').off(model.endQueueWatchEvent, queueWatch);
          onEnd()
        }
      };
      $('body').on(model.endQueueWatchEvent, queueWatch);
    }
    return queue
  }

  model.shouldSnap = function(event) {
    return !event.ctrlKey
  }

  model.holodeckModeMouseDown = {};

  model.holodeckModeMouseDown.fab = function (mdevent) {
    if (mdevent.button === LeftButton) {
      model.beginFabDown(mdevent)
      return true;
    }
    else if (mdevent.button === RightButton) {
      model.endFabMode();
      return true;
    }
    return false;
  };

  model.holodeckModeMouseDown['default'] = function (mdevent) {
    if (mdevent.button === LeftButton) {
      model.standardDown(mdevent)
      return true;
    }
    else if (mdevent.button === RightButton) {
      return model.contextualActionDown(mdevent)
    }
    return false;
  };

  var holodeckCommandMouseDown = function (command, targetable) {
    return function (mdevent) {
      if (mdevent.button === LeftButton) {
        model.commandModeDown(mdevent, command, targetable)
        return true;
      } else if (mdevent.button === RightButton) {
        model.endCommandMode()
        return true;
      }
    };
  };

  for (var i = 0; i < model.commands().length; ++i) {
    var command = model.commands()[i];
    var targetable = model.targetableCommands()[i];
    model.holodeckModeMouseDown['command_' + command] =
      holodeckCommandMouseDown(command, targetable);
  }

  model.holodeckMouseDown = function (mdevent) {
    mdevent.holodeck = api.Holodeck.get(this);

    var handler = model.holodeckModeMouseDown[model.mode()];
    if (handler && handler(mdevent)) {
      mdevent.preventDefault();
      mdevent.stopPropagation();
      return;
    }

    if (mdevent.button === MiddleButton) {
      model.holdMousePan(mdevent)
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
    model.holodeckMouseDown.apply(this, arguments)
    //var t2 = new Date().getTime()
    //console.log(t2 - t1)
  });
})()
