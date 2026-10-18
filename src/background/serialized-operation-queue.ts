export class SerializedOperationQueue {
  private tail: Promise<void> = Promise.resolve();
  private idle = true;

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.idle
      ? this.startImmediately(operation)
      : this.tail.then(operation, operation);
    this.track(result);
    return result;
  }

  private startImmediately<T>(operation: () => Promise<T>): Promise<T> {
    this.idle = false;
    try {
      return Promise.resolve(operation());
    } catch (error) {
      // A synchronous throw from `operation()` becomes the same rejection an
      // async one would produce. Wrapped when it is not already an Error so
      // the rejection reason always carries a stack.
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error), { cause: error }),
      );
    }
  }

  private track(result: Promise<unknown>): void {
    const completion = result.then(
      () => undefined,
      () => undefined,
    );
    this.tail = completion;
    void completion.then(() => {
      if (this.tail === completion) this.idle = true;
    });
  }
}
