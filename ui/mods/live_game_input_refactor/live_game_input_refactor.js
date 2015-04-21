(function() {
  var self = model

  self.registerSelectionChangeFrom = function(prevSelection) {
    return function (selection) {
      if (!selection) return null

      var jSelection = JSON.parse(selection);
      self.parseSelection(jSelection);
      self.playSelectionSound(!!prevSelection, prevSelection, !!self.selection(), self.selection());
      return jSelection;
    }
  }

  self.draggableCommand = function(mdevent, delay, responders) {
    var dragTime = new Date().getTime() + 0;
    var dragging = false
    input.capture(mdevent.holodeck.div, function (event) {
      event.holodeck = mdevent.holodeck
      //if (self.showTimeControls())
        //self.endCommandMode();

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

  self.captureFormationFacing = function(mdevent, event, command, queue, onExit) {
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
            .then(self.playCommandSound(event, command))
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

  self.playCommandSound = function(event, command) {
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

  self.holdMousePan = function(mdevent) {
    var oldMode = self.mode();
    self.mode('camera');
    mdevent.holodeck.beginControlCamera();
    input.capture(mdevent.holodeck.div, function (event) {
      var mouseDone = ((event.type === 'mouseup') && (event.button === mdevent.button));
      var escKey = ((event.type === 'keydown') && (event.keyCode === keyboard.esc));
      if (mouseDone || escKey) {
        input.release();
        mdevent.holodeck.endControlCamera();
        if (self.mode() === 'camera')
          self.mode(oldMode);
      }
    });
  }

  self.completeFabRotate = function(queue, event) {
    var snap = self.shouldSnap(event)
    event.holodeck.unitEndFab(event.offsetX, event.offsetY, queue, snap).then(function (success) {
      event.holodeck.showCommandConfirmation("", event.offsetX, event.offsetY);
      if (success)
        api.audio.playSound("/SE/UI/UI_Building_place");
    });
    if (self.mode() === 'fab_end') queue = false;
    self.mode('fab');
    if (!queue)
      self.endFabMode();
  }

  self.beginFabDown = function(mdevent) {
    var queue = self.checkQueueAndWatchForEnd(mdevent, model.fabCount, function() {
      if (self.mode() === 'fab')
        self.endFabMode();
      else if (self.mode() === 'fab_rotate')
        self.mode('fab_end');
    })

    mdevent.holodeck.unitBeginFab(
      mdevent.offsetX,
      mdevent.offsetY,
      self.shouldSnap(mdevent))

    self.mode('fab_rotate');
    input.capture(mdevent.holodeck.div, function (event) {
      event.holodeck = mdevent.holodeck
      if ((event.type === 'mouseup') && (event.button === mdevent.button)) {
        input.release();
        self.completeFabRotate(queue, event)
      }
      else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
        input.release();
        mdevent.holodeck.unitCancelFab();
        self.endFabMode();
      }
    });
  }

  self.celestialTargetDown = function(mdevent) {
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

  self.selectSingleClick = function(mdevent) {
    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;

    var prevSelection = model.selection();

    delete holodeck.doubleClickId;
    self.mode('select');

    self.draggableCommand(mdevent, 0, {
      start: function(event) {
        holodeck.beginDragSelect(startx, starty);
      },
      end: function(event) {
        var option = self.getSelectOption(event);
        holodeck.endDragSelect(option, {
          left: startx,
          top: starty,
          right: event.offsetX,
          bottom: event.offsetY
        }).then(self.registerSelectionChangeFrom(prevSelection))

        self.mode('default');
      },
      click: function(event) {
        if (self.hasWorldHoverTarget())
          holodeck.doubleClickId = self.worldHoverTarget();
        var index = (holodeck.clickOffset || 0);
        var option = self.getSelectOption(event);
        holodeck.selectAt(option, startx, starty, index)
          .then(self.registerSelectionChangeFrom(prevSelection))
          .then(function (selection) {
            if (selection && selection.selectionResult) {
              holodeck.doubleClickId = selection.selectionResult[0];
              ++holodeck.clickOffset;
              if (!selection.selectionResult.length)
                api.camera.maybeSetFocusPlanet();

            }
          });

        self.mode('default');
        holodeck.showCommandConfirmation("", event.offsetX, event.offsetY);
      },
      cancel: function() {
        holodeck.endDragSelect('cancel');
        self.mode('default');
      }
    })
  }

  self.selectDoubleClick = function(mdevent) {
    if (mdevent.holodeck.hasOwnProperty('doubleClickId')) {
      mdevent.holodeck.selectMatchingUnits(
          self.getSelectOption(mdevent),
          [mdevent.holodeck.doubleClickId])
        .then(self.registerSelectionChangeFrom(self.selection()))
      delete mdevent.holodeck.doubleClickId;
    }
  }

  self.selectDown = function(mdevent) {
    var now = new Date().getTime();
    if (now < mdevent.holodeck.doubleClickTime) {
      self.selectDoubleClick(mdevent)

      delete mdevent.holodeck.doubleClickTime;
    }
    else {
      mdevent.holodeck.doubleClickTime = now + 250;

      self.selectSingleClick(mdevent)
    }
  }

  self.standardDown = function(mdevent) {
    if (model.celestialControlActive()) {
      self.celestialTargetDown(mdevent)
    } else {
      self.selectDown(mdevent)
    }
  }

  self.contextualActionDown = function(mdevent) {
    if (self.showTimeControls()) return false
    if (self.celestialControlActive()) return false

    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;
    var queue = self.shouldQueueCommand(mdevent)

    var dragCommand = "";

    self.draggableCommand(mdevent, 75, {
      start: function(event) {
        holodeck.unitBeginGo(startx, starty, model.allowCustomFormations()).then( function(ok) {
          dragCommand = ok;
          if (dragCommand)
            self.mode("command_" + dragCommand);
        } );
      },
      end: function(event) {
        if (dragCommand === 'move') {
          self.captureFormationFacing(mdevent, event, 'move', queue,
                                      function() {self.mode('default')})
        } else {
          holodeck.unitEndCommand(dragCommand,
              event.offsetX, event.offsetY, queue)
            .then(self.playCommandSound(event, dragCommand))
        }
      },
      click: function(event) {
        holodeck.unitGo(startx, starty, queue)
          .then(self.playCommandSound(event, null))
        self.mode('default');
      },
      cancel: function(event) {
        holodeck.unitCancelCommand();
        self.mode('default');
      },
    })

    return true;
  }

  self.commandModeDown = function(mdevent, command, targetable) {
    engine.call('camera.cameraMaybeSetFocusPlanet');
    var holodeck = mdevent.holodeck
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;
    var queue = self.checkQueueAndWatchForEnd(mdevent, model.cmdQueueCount, self.endCommandMode)

    if (!model.allowCustomFormations() && (command === 'move' || command === 'unload')) {
      holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, queue)
        .then(self.playCommandSound(mdevent, command));
      if (!queue)
        self.endCommandMode();

      return
    }

    self.draggableCommand(mdevent, 125, {
      start: function(event, setDragging) {
        holodeck.unitBeginCommand(command, startx, starty).then(setDragging);
      },
      end: function(event) {
        if ((command === 'move' || command === 'unload')) {
          self.captureFormationFacing(mdevent, event, command, queue,
              function() {
                if (!queue)
                  self.endCommandMode();
              })
        }
        else {
          holodeck.unitEndCommand(command,
              event.offsetX, event.offsetY, queue)
            .then(self.playCommandSound(event, command))
          if (!queue)
            self.endCommandMode();
        }
      },
      click: function(event) {
        if (self.hasWorldHoverTarget() && targetable) {
          api.unit.targetCommand(command, self.worldHoverTarget(), queue)
            .then(self.playCommandSound(event, command));
        }
        else {
          holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, queue)
            .then(self.playCommandSound(event, command));
        }

        if (!queue)
          self.endCommandMode();
      },
      cancel: function(event) {
        holodeck.unitCancelCommand();
        self.mode('command_' + command);
      },
    })
  }

  var LeftButton = 0
  var MiddleButton = 1
  var RightButton = 2

  self.getSelectOption = function(event) {
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

  self.endQueueWatchEvent = 'keyup'
  self.shouldQueueCommand = function(event) {
    return event.shiftKey
  }

  self.checkQueueAndWatchForEnd = function(mdevent, counter, onEnd) {
    var queue = self.shouldQueueCommand(mdevent)
    counter(counter() + 1);
    if (queue && (counter() === 1)) {
      var queueWatch = function (keyEvent) {
        if (!self.shouldQueueCommand(keyEvent)) {
          $('body').off(self.endQueueWatchEvent, queueWatch);
          onEnd()
        }
      };
      $('body').on(self.endQueueWatchEvent, queueWatch);
    }
    return queue
  }

  self.shouldSnap = function(event) {
    return !event.ctrlKey
  }

  self.holodeckModeMouseDown = {};

  self.holodeckModeMouseDown.fab = function (mdevent) {
    if (mdevent.button === LeftButton) {
      self.beginFabDown(mdevent)
      return true;
    }
    else if (mdevent.button === RightButton) {
      self.endFabMode();
      return true;
    }
    return false;
  };

  self.holodeckModeMouseDown['default'] = function (mdevent) {
    if (mdevent.button === LeftButton) {
      self.standardDown(mdevent)
      return true;
    }
    else if (mdevent.button === RightButton) {
      return self.contextualActionDown(mdevent)
    }
    return false;
  };

  var holodeckCommandMouseDown = function (command, targetable) {
    return function (mdevent) {
      if (mdevent.button === LeftButton) {
        self.commandModeDown(mdevent, command, targetable)
        return true;
      }
    };
  };

  for (var i = 0; i < self.commands().length; ++i) {
    var command = self.commands()[i];
    var targetable = self.targetableCommands()[i];
    self.holodeckModeMouseDown['command_' + command] =
      holodeckCommandMouseDown(command, targetable);
  }

  self.holodeckMouseDown = function (mdevent) {
    mdevent.holodeck = api.Holodeck.get(this);

    var handler = self.holodeckModeMouseDown[self.mode()];
    if (handler && handler(mdevent)) {
      mdevent.preventDefault();
      mdevent.stopPropagation();
      return;
    }

    if (mdevent.button === MiddleButton) {
      self.holdMousePan(mdevent)
      mdevent.preventDefault();
      mdevent.stopPropagation();
      return;
    }

    if (mdevent.button === RightButton && self.mode() !== 'default') {
      self.endCommandMode()
    }
  }

  //  :-( :-( :-(
  $('holodeck').off('mousedown')

  $('holodeck').mousedown(function(mdevent) {
    if (mdevent.target.nodeName !== 'HOLODECK')
      return;

    self.holodeckMouseDown.apply(this, arguments)
  });
})()
